/*
Copyright (c) 2011 Juan Mellado

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

/*
References:
- "ArUco: a minimal library for Augmented Reality applications based on OpenCv"
  http://www.uco.es/investiga/grupos/ava/node/26
*/

var AR = AR || {};

AR.Marker = function(id, corners){
  this.id = id;
  this.corners = corners;
};

AR.Detector = function(){
  this.grey = new CV.Image();
  this.thres = new CV.Image();
  this.homography = new CV.Image();
  this.binary = [];
  this.contours = [];
  this.polys = [];
  this.candidates = [];
};

AR.Detector.prototype.detect = function(image){
  CV.grayscale(image, this.grey);
  CV.adaptiveThreshold(this.grey, this.thres, 2, 7);
  
  this.contours = CV.findContours(this.thres, this.binary);

  this.candidates = this.findCandidates(this.contours, image.width * 0.20, 0.05, 10);
  this.candidates = this.clockwiseCorners(this.candidates);
  this.candidates = this.notTooNear(this.candidates, 10);

  return this.findMarkers(this.grey, this.candidates, 64);  // 64x64に変更
};

AR.Detector.prototype.findCandidates = function(contours, minSize, epsilon, minLength){
  var candidates = [], len = contours.length, contour, poly, i;

  this.polys = [];
  
  for (i = 0; i < len; ++ i){
    contour = contours[i];

    if (contour.length >= minSize){
      poly = CV.approxPolyDP(contour, contour.length * epsilon);

      this.polys.push(poly);

      if ( (4 === poly.length) && ( CV.isContourConvex(poly) ) ){

        if ( CV.minEdgeLength(poly) >= minLength){
          candidates.push(poly);
        }
      }
    }
  }

  return candidates;
};

AR.Detector.prototype.clockwiseCorners = function(candidates){
  var len = candidates.length, dx1, dx2, dy1, dy2, swap, i;

  for (i = 0; i < len; ++ i){
    dx1 = candidates[i][1].x - candidates[i][0].x;
    dy1 = candidates[i][1].y - candidates[i][0].y;
    dx2 = candidates[i][2].x - candidates[i][0].x;
    dy2 = candidates[i][2].y - candidates[i][0].y;

    if ( (dx1 * dy2 - dy1 * dx2) < 0){
      swap = candidates[i][1];
      candidates[i][1] = candidates[i][3];
      candidates[i][3] = swap;
    }
  }

  return candidates;
};

AR.Detector.prototype.notTooNear = function(candidates, minDist){
  var notTooNear = [], len = candidates.length, dist, dx, dy, i, j, k;

  for (i = 0; i < len; ++ i){
  
    for (j = i + 1; j < len; ++ j){
      dist = 0;
      
      for (k = 0; k < 4; ++ k){
        dx = candidates[i][k].x - candidates[j][k].x;
        dy = candidates[i][k].y - candidates[j][k].y;
      
        dist += dx * dx + dy * dy;
      }
      
      if ( (dist / 4) < (minDist * minDist) ){
      
        if ( CV.perimeter( candidates[i] ) < CV.perimeter( candidates[j] ) ){
          candidates[i].tooNear = true;
        }else{
          candidates[j].tooNear = true;
        }
      }
    }
  }

  for (i = 0; i < len; ++ i){
    if ( !candidates[i].tooNear ){
      notTooNear.push( candidates[i] );
    }
  }

  return notTooNear;
};

AR.Detector.prototype.findMarkers = function(imageSrc, candidates, warpSize){
  var markers = [], len = candidates.length, candidate, marker, i;

  for (i = 0; i < len; ++ i){
    candidate = candidates[i];

    CV.warp(imageSrc, this.homography, candidate, warpSize);
  
    CV.threshold(this.homography, this.homography, CV.otsu(this.homography) );

    marker = this.getMarker(this.homography, candidate);
    if (marker){
      markers.push(marker);
    }
  }
  
  return markers;
};

// ビットパターンを生成する関数
function generateMarkerBits(id) {
  let bits = new Array(4).fill(0).map(() => new Array(4).fill(0));
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      bits[y][x] = (id & (1 << (15 - (y * 4 + x)))) ? 1 : 0;
    }
  }
  return bits;
}

// ハミング距離を計算する関数
function hammingDistance(bits1, bits2) {
  let distance = 0;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      if (bits1[y][x] !== bits2[y][x]) {
        distance++;
      }
    }
  }
  return distance;
}

AR.Detector.prototype.getMarker = function(imageSrc, candidate) {
  var width = (imageSrc.width / 8) >>> 0,
      minZero = (width * width) >> 1,
      bits = [], rotations = [], distances = [],
      square, bestDistance, bestId, bestRotation, i, j;

  // マーカーの外枠が黒であることを確認
  for (i = 0; i < 8; ++i) {
    let inc = (0 === i || 7 === i) ? 1 : 7;
    for (j = 0; j < 8; j += inc) {
      square = {x: j * width, y: i * width, width: width, height: width};
      if (CV.countNonZero(imageSrc, square) > minZero) {
        return null;
      }
    }
  }

  // 6x6のビットパターンを読み取る（境界を含む）
  for (i = 0; i < 6; ++i) {
    bits[i] = [];
    for (j = 0; j < 6; ++j) {
      square = {x: j * width, y: i * width, width: width, height: width};
      bits[i][j] = CV.countNonZero(imageSrc, square) > minZero ? 1 : 0;
    }
  }

  bestDistance = Infinity;
  bestId = -1;
  bestRotation = 0;

  // 4つの回転を試す
  for (i = 0; i < 4; ++i) {
    rotations[i] = this.rotate(bits, i);
    let innerBits = rotations[i].slice(1, 5).map(row => row.slice(1, 5));

    // 可能なすべてのIDに対してハミング距離を計算
    for (let id = 0; id < 1000; id++) {  // 1000は例です。必要に応じて調整してください
      let markerBits = generateMarkerBits(id);
      let distance = hammingDistance(innerBits, markerBits);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestId = id;
        bestRotation = i;
      }
    }
  }

  if (bestDistance > 0) {  // 完全一致しない場合はnullを返す。必要に応じて閾値を調整
    return null;
  }

  return new AR.Marker(bestId, this.rotate2(candidate, 4 - bestRotation));
};

AR.Detector.prototype.rotate = function(src, rotation) {
  let dst = JSON.parse(JSON.stringify(src));  // ディープコピー
  for (let i = 0; i < rotation; i++) {
    dst = dst[0].map((_, index) => dst.map(row => row[index]).reverse());
  }
  return dst;
};

AR.Detector.prototype.rotate2 = function(src, rotation){
  var dst = [], len = src.length, i;
  
  for (i = 0; i < len; ++ i){
    dst[i] = src[ (rotation + i) % len ];
  }

  return dst;
};
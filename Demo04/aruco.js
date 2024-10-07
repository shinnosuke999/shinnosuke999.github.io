// AR名前空間を定義
var AR = AR || {};

// マーカーオブジェクトを定義するコンストラクタ
AR.Marker = function(id, corners){
  this.id = id;        // マーカーのID
  this.corners = corners;  // マーカーの四隅の座標
};

// マーカー検出器のコンストラクタ
AR.Detector = function(){
  // 画像処理に使用する各種オブジェクトを初期化
  this.grey = new CV.Image();      // グレースケール画像
  this.thres = new CV.Image();     // 二値化画像
  this.homography = new CV.Image(); // ホモグラフィ変換後の画像
  this.binary = [];    // 二値化データ
  this.contours = [];  // 輪郭データ
  this.polys = [];     // ポリゴンデータ
  this.candidates = []; // マーカー候補
};

// マーカーを検出するメイン関数
AR.Detector.prototype.detect = function(image){
  // 画像をグレースケールに変換
  CV.grayscale(image, this.grey);
  // 適応的閾値処理を適用
  CV.adaptiveThreshold(this.grey, this.thres, 2, 7);
  
  // 輪郭を検出
  this.contours = CV.findContours(this.thres, this.binary);

  // マーカー候補を見つける
  this.candidates = this.findCandidates(this.contours, image.width * 0.20, 0.05, 10);
  // 候補の角を時計回りに並べ替え
  this.candidates = this.clockwiseCorners(this.candidates);
  // 近すぎる候補を除外
  this.candidates = this.notTooNear(this.candidates, 10);

  // 最終的なマーカーを検出して返す（ワープサイズを64x64に変更）
  return this.findMarkers(this.grey, this.candidates, 64);
};

// マーカー候補を見つける関数
AR.Detector.prototype.findCandidates = function(contours, minSize, epsilon, minLength){
  var candidates = [], len = contours.length, contour, poly, i;

  this.polys = [];
  
  for (i = 0; i < len; ++ i){
    contour = contours[i];

    // 輪郭が一定のサイズ以上の場合のみ処理
    if (contour.length >= minSize){
      // 輪郭を多角形に近似
      poly = CV.approxPolyDP(contour, contour.length * epsilon);

      this.polys.push(poly);

      // 4つの頂点を持つ凸多角形のみをマーカー候補とする
      if ( (4 === poly.length) && ( CV.isContourConvex(poly) ) ){
        if ( CV.minEdgeLength(poly) >= minLength){
          candidates.push(poly);
        }
      }
    }
  }

  return candidates;
};

// 角を時計回りに並べ替える関数
AR.Detector.prototype.clockwiseCorners = function(candidates){
  var len = candidates.length, dx1, dx2, dy1, dy2, swap, i;

  for (i = 0; i < len; ++ i){
    dx1 = candidates[i][1].x - candidates[i][0].x;
    dy1 = candidates[i][1].y - candidates[i][0].y;
    dx2 = candidates[i][2].x - candidates[i][0].x;
    dy2 = candidates[i][2].y - candidates[i][0].y;

    // 外積が負の場合、頂点の順序を入れ替え
    if ( (dx1 * dy2 - dy1 * dx2) < 0){
      swap = candidates[i][1];
      candidates[i][1] = candidates[i][3];
      candidates[i][3] = swap;
    }
  }

  return candidates;
};

// 近すぎる候補を除外する関数
AR.Detector.prototype.notTooNear = function(candidates, minDist){
  var notTooNear = [], len = candidates.length, dist, dx, dy, i, j, k;

  for (i = 0; i < len; ++ i){
    for (j = i + 1; j < len; ++ j){
      dist = 0;
      
      // 各頂点間の距離の二乗和を計算
      for (k = 0; k < 4; ++ k){
        dx = candidates[i][k].x - candidates[j][k].x;
        dy = candidates[i][k].y - candidates[j][k].y;
      
        dist += dx * dx + dy * dy;
      }
      
      // 平均距離が閾値以下の場合、小さい方を除外
      if ( (dist / 4) < (minDist * minDist) ){
        if ( CV.perimeter( candidates[i] ) < CV.perimeter( candidates[j] ) ){
          candidates[i].tooNear = true;
        }else{
          candidates[j].tooNear = true;
        }
      }
    }
  }

  // tooNearフラグが立っていない候補のみを残す
  for (i = 0; i < len; ++ i){
    if ( !candidates[i].tooNear ){
      notTooNear.push( candidates[i] );
    }
  }

  return notTooNear;
};

// マーカーを見つけて確認する関数
AR.Detector.prototype.findMarkers = function(imageSrc, candidates, warpSize){
  var markers = [], len = candidates.length, candidate, marker, i;

  for (i = 0; i < len; ++ i){
    candidate = candidates[i];

    // 候補領域を正方形に変形
    CV.warp(imageSrc, this.homography, candidate, warpSize);
  
    // 二値化
    CV.threshold(this.homography, this.homography, CV.otsu(this.homography) );

    // マーカーとして認識できるかチェック
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
      // IDの各ビットを4x4グリッドに配置
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
      // 異なるビットの数をカウント
      if (bits1[y][x] !== bits2[y][x]) {
        distance++;
      }
    }
  }
  return distance;
}

// 個々のマーカーを認識し、IDを割り当てる関数
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
    let id = this.mat2id(innerBits);

    if (id !== -1) {
      let distance = hammingDistance(innerBits, generateMarkerBits(id));
      if (distance < bestDistance) {
        bestDistance = distance;
        bestId = id;
        bestRotation = i;
      }
    }
  }

  // 完全一致しない場合はnullを返す（必要に応じて閾値を調整）
  if (bestDistance > 0) {
    return null;
  }

  return new AR.Marker(bestId, this.rotate2(candidate, 4 - bestRotation));
};

// ビットパターンからIDを計算する関数
AR.Detector.prototype.mat2id = function(bits) {
  let id = 0;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      // 各ビットをIDに変換
      id <<= 1;
      id |= bits[y][x];
    }
  }
  return id;
};

// ビットパターンを回転させる関数
AR.Detector.prototype.rotate = function(src, rotation) {
  let dst = JSON.parse(JSON.stringify(src));  // ディープコピー
  for (let i = 0; i < rotation; i++) {
    // 90度回転を指定回数実行
    dst = dst[0].map((_, index) => dst.map(row => row[index]).reverse());
  }
  return dst;
};

// マーカーの角を回転させる関数
AR.Detector.prototype.rotate2 = function(src, rotation){
  var dst = [], len = src.length, i;
  
  for (i = 0; i < len; ++ i){
    dst[i] = src[ (rotation + i) % len ];
  }

  return dst;
};
// グローバル変数の宣言
var camera, canvas, context, imageData, pixels, detector;
var debugImage, warpImage, homographyImage;

// ページ読み込み完了時に実行される関数
function onLoad(){
  // HTML要素の取得
  camera = document.getElementById("video");
  canvas = document.getElementById("canvas");
  context = canvas.getContext("2d");
  
  // カメラのサイズを設定
  camera.width = 320;
  camera.height = 240;
  
  // キャンバスのサイズを設定
  canvas.width = parseInt(canvas.style.width);
  canvas.height = parseInt(canvas.style.height);
  
  // ブラウザ互換性のためのチェックと設定
  if (navigator.mediaDevices === undefined) {
    navigator.mediaDevices = {};
  }
  
  if (navigator.mediaDevices.getUserMedia === undefined) {
    navigator.mediaDevices.getUserMedia = function(constraints) {
      var getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
      
      if (!getUserMedia) {
        return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
      }

      return new Promise(function(resolve, reject) {
        getUserMedia.call(navigator, constraints, resolve, reject);
      });
    }
  }
  
  // カメラへのアクセスを要求
  navigator.mediaDevices
    .getUserMedia({ video: true })
    .then(function(stream) {
      if ("srcObject" in video) {
        video.srcObject = stream;
      } else {
        video.src = window.URL.createObjectURL(stream);
      }
    })
    .catch(function(err) {
      console.log(err.name + ": " + err.message);
    }
  );
    
  // 画像処理用の変数を初期化
  imageData = context.getImageData(0, 0, camera.width, camera.height);
  pixels = [];
  detector = new AR.Detector();
  
  debugImage = context.createImageData(camera.width, camera.height);
  warpImage = context.createImageData(49, 49);
  homographyImage = new CV.Image();
  
  // アニメーションループを開始
  requestAnimationFrame(tick);
}
/*
// メインのアニメーションループ
function tick(){
  requestAnimationFrame(tick);
  
  if (video.readyState === video.HAVE_ENOUGH_DATA){
    snapshot();

    var markers = detector.detect(imageData);
    drawDebug();
    drawCorners(markers);
    drawId(markers);
    displayMarkerInfo(markers);
  }
}
*/

// ビデオフレームをキャンバスに描画
function snapshot(){
  context.drawImage(video, 0, 0, camera.width, camera.height);
  imageData = context.getImageData(0, 0, camera.width, camera.height);
}
      
// デバッグ情報を描画
function drawDebug(){
  var width = camera.width, height = camera.height;
  
  context.clearRect(0, 0, canvas.width, canvas.height);
  
  context.putImageData(imageData, 0, 0);
  context.putImageData( createImage(detector.grey, debugImage), width, 0);
  context.putImageData( createImage(detector.thres, debugImage), width * 2, 0);
  
  drawContours(detector.contours, 0, height, width, height, function(hole) {return hole? "magenta": "blue";});
  drawContours(detector.polys, width, height, width, height, function() {return "green";} );
  drawContours(detector.candidates, width * 2, height, width, height, function() {return "red";} );
  
  drawWarps(detector.grey, detector.candidates, 0, height * 2 + 20);
}

// 輪郭を描画
function drawContours(contours, x, y, width, height, fn){
  var i = contours.length, j, contour, point;
  
  while(i --){
    contour = contours[i];

    context.strokeStyle = fn(contour.hole);
    context.beginPath();

    for (j = 0; j < contour.length; ++ j){
      point = contour[j];
      this.context.moveTo(x + point.x, y + point.y);
      point = contour[(j + 1) % contour.length];
      this.context.lineTo(x + point.x, y + point.y);
    }
    
    context.stroke();
    context.closePath();
  }
}

// ワープ画像を描画
function drawWarps(imageSrc, contours, x, y){
  var i = contours.length, j, contour;
  
  var offset = ( canvas.width - ( (warpImage.width + 10) * contours.length) ) / 2
  while(i --){
    contour = contours[i];
    
    CV.warp(imageSrc, homographyImage, contour, warpImage.width);
    this.context.putImageData( createImage(homographyImage, warpImage), offset + i * (warpImage.width + 10), y);
    
    CV.threshold(homographyImage, homographyImage, CV.otsu(homographyImage) );
    this.context.putImageData( createImage(homographyImage, warpImage), offset + i * (warpImage.width + 10), y + 60);
  }
}

// マーカーの角を描画
function drawCorners(markers){
  var corners, corner, i, j;

  context.lineWidth = 3;

  for (i = 0; i !== markers.length; ++ i){
    corners = markers[i].corners;
    
    context.strokeStyle = "red";
    context.beginPath();
    
    for (j = 0; j !== corners.length; ++ j){
      corner = corners[j];
      context.moveTo(corner.x, corner.y);
      corner = corners[(j + 1) % corners.length];
      context.lineTo(corner.x, corner.y);
    }

    context.stroke();
    context.closePath();
    
    context.strokeStyle = "green";
    context.strokeRect(corners[0].x - 2, corners[0].y - 2, 4, 4);
  }
}

// マーカーIDを描画←確認用
function drawId(markers){
  var corners, corner, x, y, i, j;
  
  context.strokeStyle = "blue";
  context.lineWidth = 1;
  
  for (i = 0; i !== markers.length; ++ i){
    corners = markers[i].corners;
    
    x = Infinity;
    y = Infinity;
    
    for (j = 0; j !== corners.length; ++ j){
      corner = corners[j];
      
      x = Math.min(x, corner.x);
      y = Math.min(y, corner.y);
    }

    context.strokeText(markers[i].id, x, y)
  }
}

// 画像データを作成
function createImage(src, dst){
  var i = src.data.length, j = (i * 4) + 3;
  
  while(i --){
    dst.data[j -= 4] = 255;
    dst.data[j - 1] = dst.data[j - 2] = dst.data[j - 3] = src.data[i];
  }
  
  return dst;
};
// マーカー情報を表示
function displayMarkerInfo(markers) {
    context.font = "20px Arial";
    context.fillStyle = "white";
    context.strokeStyle = "black";
    context.lineWidth = 3;
  
    var text;
    if (markers.length > 0) {
      text = "マーカーID: " + markers[0].id;
    } else {
      text = "マーカー認識中";
    }
  
    var x = 10;
    var y = canvas.height - 10;
  
    context.strokeText(text, x, y);
    context.fillText(text, x, y);
  }
  
  // メインのアニメーションループ
  function tick(){
    requestAnimationFrame(tick);
    
    if (video.readyState === video.HAVE_ENOUGH_DATA){
      snapshot();
  
      var markers = detector.detect(imageData);
      drawDebug();
      drawCorners(markers);
      drawId(markers);
      displayMarkerInfo(markers);
    }
  }
  
  // ページ読み込み完了時にonLoad関数を実行
  window.onload = onLoad;
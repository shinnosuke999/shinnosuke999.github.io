// グローバル変数の宣言
var camera, canvas, context, imageData, detector;

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
  canvas.width = 960;
  canvas.height = 720;
  
  // カメラへのアクセスを要求
  navigator.mediaDevices
    .getUserMedia({ video: true })
    .then(function(stream) {
      camera.srcObject = stream;
      camera.onloadedmetadata = function(e) {
        camera.play();
      };
    })
    .catch(function(err) {
      console.log(err.name + ": " + err.message);
    });
    
  // 検出器を初期化
  detector = new AR.Detector();
  
  // アニメーションループを開始
  requestAnimationFrame(tick);
}

// メインのアニメーションループ
function tick(){
  requestAnimationFrame(tick);
  
  if (camera.readyState === camera.HAVE_ENOUGH_DATA){
    snapshot();

    var markers = detector.detect(imageData);
    drawCorners(markers);
    drawId(markers);
    displayMarkerInfo(markers);
  }
}

// ビデオフレームをキャンバスに描画
function snapshot(){
  context.drawImage(camera, 0, 0, canvas.width, canvas.height);
  imageData = context.getImageData(0, 0, canvas.width, canvas.height);
}

// マーカーの角を描画
function drawCorners(markers){
  context.lineWidth = 3;

  for (var i = 0; i < markers.length; i++){
    var corners = markers[i].corners;
    
    context.strokeStyle = "red";
    context.beginPath();
    
    for (var j = 0; j < corners.length; j++){
      var corner = corners[j];
      var nextCorner = corners[(j + 1) % corners.length];
      context.moveTo(corner.x, corner.y);
      context.lineTo(nextCorner.x, nextCorner.y);
    }

    context.stroke();
    context.closePath();
    
    context.strokeStyle = "green";
    context.strokeRect(corners[0].x - 2, corners[0].y - 2, 4, 4);
  }
}

// マーカーIDを描画
function drawId(markers){
  context.strokeStyle = "blue";
  context.lineWidth = 1;
  context.font = "16px Arial";
  
  for (var i = 0; i < markers.length; i++){
    var corners = markers[i].corners;
    var x = corners[0].x;
    var y = corners[0].y;

    context.strokeText(markers[i].id, x, y - 15);
  }
}

// マーカー情報を表示
function displayMarkerInfo(markers) {
  context.font = "20px Arial";
  context.fillStyle = "white";
  context.strokeStyle = "black";
  context.lineWidth = 3;

  var text = markers.length > 0 ? "マーカーID: " + markers[0].id : "マーカー認識中";

  var x = 10;
  var y = canvas.height - 10;

  context.strokeText(text, x, y);
  context.fillText(text, x, y);
}

// ページ読み込み完了時にonLoad関数を実行
window.onload = onLoad;
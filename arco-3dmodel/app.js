// グローバル変数の宣言
var video, canvas, context, imageData, detector;
var scene, camera, renderer, model;

function onLoad() {
  video = document.getElementById("video");
  canvas = document.getElementById("canvas");
  context = canvas.getContext("2d");

  // カメラのセットアップ
  navigator.mediaDevices.getUserMedia({ video: true })
    .then(function(stream) {
      video.srcObject = stream;
    })
    .catch(function(err) {
      console.log("エラー: " + err);
    });

  // AR.jsの設定
  detector = new AR.Detector();

  // Three.jsの初期化
  initThree();

  // アニメーションループの開始
  requestAnimationFrame(tick);
}

function initThree() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // 光源の追加
  var light = new THREE.AmbientLight(0xffffff);
  scene.add(light);

  // GLTFローダーの作成
  var loader = new THREE.GLTFLoader();

  // モデルの読み込み
  loader.load('models/1human_and_dog.glb', function(gltf) {
    model = gltf.scene;
    model.scale.set(0.1, 0.1, 0.1); // モデルのサイズ調整
    scene.add(model);
    model.visible = false; // 初期状態では非表示
  });

  camera.position.z = 5;
}

function tick() {
  requestAnimationFrame(tick);

  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    snapshot();

    var markers = detector.detect(imageData);
    drawCorners(markers);
    drawId(markers);
    updateScene(markers);
  }

  renderer.render(scene, camera);
}

function snapshot() {
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  imageData = context.getImageData(0, 0, canvas.width, canvas.height);
}

function drawCorners(markers) {
  var corners, corner, i, j;

  context.lineWidth = 3;

  for (i = 0; i !== markers.length; ++ i) {
    corners = markers[i].corners;
    
    context.strokeStyle = "red";
    context.beginPath();
    
    for (j = 0; j !== corners.length; ++ j) {
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

function drawId(markers) {
  var corners, corner, x, y, i, j;
  
  context.strokeStyle = "blue";
  context.lineWidth = 1;
  
  for (i = 0; i !== markers.length; ++ i) {
    corners = markers[i].corners;
    
    x = Infinity;
    y = Infinity;
    
    for (j = 0; j !== corners.length; ++ j) {
      corner = corners[j];
      
      x = Math.min(x, corner.x);
      y = Math.min(y, corner.y);
    }

    context.strokeText(markers[i].id, x, y);
  }
}

function updateScene(markers) {
  if (markers.length > 0 && markers[0].id === 0) {
    if (model) {
      model.visible = true;
      
      // マーカーの中心を計算
      var centerX = 0, centerY = 0;
      for (var i = 0; i < 4; i++) {
        centerX += markers[0].corners[i].x;
        centerY += markers[0].corners[i].y;
      }
      centerX /= 4;
      centerY /= 4;

      // 3Dモデルの位置を更新
      var vector = new THREE.Vector3(
        (centerX / canvas.width) * 2 - 1,
        -(centerY / canvas.height) * 2 + 1,
        -0.5
      );
      vector.unproject(camera);
      model.position.set(vector.x, vector.y, vector.z);
    }
  } else if (model) {
    model.visible = false;
  }
}

window.onload = onLoad;
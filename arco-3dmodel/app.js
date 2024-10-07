// グローバル変数の宣言
var video, canvas, context, imageData, detector;
var scene, camera, renderer, model;

// ページ読み込み完了時に実行される関数
function onLoad() {
  // HTML要素の取得
  video = document.getElementById("video");
  canvas = document.getElementById("canvas");
  context = canvas.getContext("2d");

  // カメラのセットアップ
  navigator.mediaDevices.getUserMedia({ 
    video: { 
      width: { ideal: 1280 },  // カメラの理想的な幅を指定
      height: { ideal: 720 }   // カメラの理想的な高さを指定
    } 
  })
  .then(function(stream) {
    video.srcObject = stream;
    video.onloadedmetadata = function(e) {
      video.play();
      // カメラの実際のサイズに合わせてキャンバスのサイズを設定
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      console.log('カメラ解像度:', video.videoWidth, 'x', video.videoHeight);
    };
  })
  .catch(function(err) {
    console.log("カメラエラー: " + err);
  });

  // AR.jsの設定（マーカー検出器の初期化）
  detector = new AR.Detector();

  // Three.jsの初期化
  initThree();

  // アニメーションループの開始
  requestAnimationFrame(tick);
}

// Three.jsの初期化関数
function initThree() {
  // シーン、カメラ、レンダラーの作成
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x000000, 0);  // 背景を透明に設定
  document.body.appendChild(renderer.domElement);

  // カメラの位置を調整
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);

  // 光源の追加
  var light = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(light);
  var directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
  directionalLight.position.set(0, 1, 0);
  scene.add(directionalLight);

  // GLTFローダーの作成
  var loader = new THREE.GLTFLoader();

  // 3Dモデルの読み込み
  loader.load('models/1human_and_dog.glb', function(gltf) {
    model = gltf.scene;
    model.scale.set(1, 1, 1);  // モデルのサイズを調整
    scene.add(model);
    model.visible = false;  // 初期状態では非表示
    console.log('3Dモデルが正常に読み込まれました');
    console.log('モデルの初期位置:', model.position);
    console.log('モデルのスケール:', model.scale);
  }, undefined, function(error) {
    console.error('モデルの読み込みに失敗しました:', error);
  });
}

// 3Dシーンの更新
function updateScene(markers) {
  console.log('検出されたマーカー数:', markers.length);
  if (markers.length > 0) {
    console.log('検出されたマーカーID:', markers[0].id);
  }

  if (markers.length > 0 && markers[0].id === 0) {
    if (model) {
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
        0
      );
      vector.unproject(camera);
      var dir = vector.sub(camera.position).normalize();
      var distance = -camera.position.z / dir.z;
      var pos = camera.position.clone().add(dir.multiplyScalar(distance));
      model.position.copy(pos);

      // マーカーの回転に合わせてモデルを回転
      var corners = markers[0].corners;
      var dx = corners[1].x - corners[0].x;
      var dy = corners[1].y - corners[0].y;
      var angle = Math.atan2(dy, dx);
      model.rotation.z = angle - Math.PI / 2;

      model.visible = true;  // モデルを表示
      console.log('3Dモデルの位置:', model.position);
      console.log('3Dモデルの回転:', model.rotation);
      console.log('3Dモデルの可視性:', model.visible);
    } else {
      console.log('3Dモデルがロードされていません');
    }
  } else {
    if (model) {
      model.visible = false;  // マーカーが検出されない場合はモデルを非表示に
    }
  }
}

// メインのアニメーションループ
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

// ページ読み込み完了時にonLoad関数を実行
window.onload = function() {
  onLoad();
};

// カメラの映像をキャンバスに描画する関数
function snapshot() {
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  imageData = context.getImageData(0, 0, canvas.width, canvas.height);
}

// マーカーのコーナーを描画する関数
function drawCorners(markers) {
  var corners, corner, i, j;

  context.lineWidth = 3;
  context.strokeStyle = "red";

  for (i = 0; i < markers.length; ++i) {
    corners = markers[i].corners;

    context.beginPath();

    for (j = 0; j < corners.length; ++j) {
      corner = corners[j];
      context.moveTo(corner.x, corner.y);
      corner = corners[(j + 1) % corners.length];
      context.lineTo(corner.x, corner.y);
    }

    context.stroke();
    context.closePath();

    context.strokeStyle = "green";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(corners[0].x, corners[0].y);
    context.lineTo(corners[2].x, corners[2].y);
    context.moveTo(corners[1].x, corners[1].y);
    context.lineTo(corners[3].x, corners[3].y);
    context.stroke();
    context.closePath();
  }
}

// マーカーIDを描画する関数
function drawId(markers) {
  var corners, corner, x, y, i, j;

  context.strokeStyle = "blue";
  context.lineWidth = 1;

  for (i = 0; i < markers.length; ++i) {
    corners = markers[i].corners;

    x = Infinity;
    y = Infinity;

    for (j = 0; j < corners.length; ++j) {
      corner = corners[j];
      x = Math.min(x, corner.x);
      y = Math.min(y, corner.y);
    }

    context.strokeText(markers[i].id, x, y);
  }
}
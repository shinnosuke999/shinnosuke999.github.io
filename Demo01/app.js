let video, canvas, context, imageData, detector;

// Three.js 変数
let scene, camera, renderer, cube;

function init() {
    video = document.getElementById("video");
    canvas = document.getElementById("canvas");
    context = canvas.getContext("2d");

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // カメラからの映像を取得
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(function(stream) {
            video.srcObject = stream;
            video.play();
        })
        .catch(function(err) {
            console.log("エラーが発生しました: " + err);
        });

    detector = new AR.Detector();

    initThreeJS();

    requestAnimationFrame(tick);
}

function initThreeJS() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    renderer = new THREE.WebGLRenderer({ alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // 簡単な立方体を3Dオブジェクトとして作成
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

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
    context.lineWidth = 3;

    for (let i = 0; i < markers.length; i++) {
        let corners = markers[i].corners;

        context.strokeStyle = "red";
        context.beginPath();

        for (let j = 0; j < corners.length; j++) {
            let corner = corners[j];
            context.moveTo(corner.x, corner.y);
            corner = corners[(j + 1) % corners.length];
            context.lineTo(corner.x, corner.y);
        }

        context.stroke();
        context.closePath();
    }
}

function drawId(markers) {
    context.strokeStyle = "blue";
    context.lineWidth = 1;

    for (let i = 0; i < markers.length; i++) {
        let corners = markers[i].corners;
        let x = corners[0].x;
        let y = corners[0].y;

        context.strokeText(markers[i].id, x, y);
    }
}

function updateScene(markers) {
    if (markers.length > 0) {
        let corners = markers[0].corners;
        
        // 最初のマーカーに基づいて立方体の位置を簡単に設定
        let centerX = (corners[0].x + corners[2].x) / 2;
        let centerY = (corners[0].y + corners[2].y) / 2;
        
        // 2D位置を3D空間に変換
        let vector = new THREE.Vector3(
            (centerX / canvas.width) * 2 - 1,
            -(centerY / canvas.height) * 2 + 1,
            -0.5
        );
        vector.unproject(camera);
        
        cube.position.set(vector.x, vector.y, vector.z);
        cube.visible = true;
    } else {
        cube.visible = false;
    }
}

// カメラからの映像を取得
navigator.mediaDevices.enumerateDevices()
    .then(function(devices) {
        // 外部カメラ（多くの場合、リストの最後のビデオデバイス）を探す
        let videoDevices = devices.filter(device => device.kind === 'videoinput');
        let externalCamera = videoDevices[videoDevices.length - 1];

        return navigator.mediaDevices.getUserMedia({
            video: {
                deviceId: externalCamera ? { exact: externalCamera.deviceId } : undefined
            }
        });
    })
    .then(function(stream) {
        video.srcObject = stream;
        video.play();
    })
    .catch(function(err) {
        console.log("エラーが発生しました: " + err);
    });


window.onload = init;
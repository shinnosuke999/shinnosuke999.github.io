const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// カメラの設定
navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(function(stream) {
        video.srcObject = stream;
    })
    .catch(function(error) {
        console.error("カメラにアクセスできません: ", error);
    });

// Three.jsの設定
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// 3Dオブジェクトの作成
const geometry = new THREE.BoxGeometry();
const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

camera.position.z = 5;

// ARマーカー検出の設定
const detector = new AR.Detector();

function animate() {
    requestAnimationFrame(animate);

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const markers = detector.detect(imageData);

        if (markers.length > 0) {
            // マーカーが検出された場合、3Dオブジェクトを配置
            const corners = markers[0].corners;
            
            // マーカーの中心を計算
            const centerX = (corners[0].x + corners[2].x) / 2;
            const centerY = (corners[0].y + corners[2].y) / 2;

            // 3Dオブジェクトの位置を更新
            cube.position.x = (centerX / canvas.width) * 2 - 1;
            cube.position.y = -(centerY / canvas.height) * 2 + 1;
        }
    }

    renderer.render(scene, camera);
}

animate();
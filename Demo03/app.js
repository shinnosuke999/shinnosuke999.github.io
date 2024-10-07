const act = (image) => {
  const dict = cv.getPredefinedDictionary(cv.DICT_6X6_1000);
  const charucoParam = new cv.aruco_CharucoParameters();
  const detectParam = new cv.aruco_DetectorParameters();
  const refineParam = new cv.aruco_RefineParameters(10, 3, true);

  const squareNum = new cv.Size(5, 7);
  const squareLength = 34.7 * 0.001;
  const markerLength = squareLength * 120 / 200;
  const ids = new cv.Mat();
  const board = new cv.aruco_CharucoBoard(squareNum, squareLength, markerLength, dict, ids);
  const multiDetector = new cv.aruco_CharucoDetector(board, charucoParam, detectParam, refineParam);

  const src = cv.imread(image);

  const rgb = new cv.Mat();
  cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB, 0);
// ボードの検出
  const charucoCorners = new cv.Mat();
  const charucoCornerIds = new cv.Mat();   
  const markerCorners = new cv.MatVector();
  const markerIds = new cv.Mat();            
  multiDetector.detectBoard(rgb, charucoCorners, charucoCornerIds, markerCorners, markerIds);

  cv.drawDetectedMarkers(rgb, markerCorners, markerIds);
// チェックコーナーを描画する
  const col = new cv.Scalar(255, 128, 0);
  cv.drawDetectedCornersCharuco(rgb, charucoCorners, charucoCornerIds, col);
// カメラキャリブレーション
  const obj3ds = new cv.MatVector();
  const foundNum = charucoCornerIds.rows;
  const corner3d = new cv.Mat(foundNum, 1, cv.CV_32FC3);
  for (let i = 0; i < foundNum; ++i) {
      const index = charucoCornerIds.intPtr(i, 0)[0];
      let x = 1 + (index % (squareNum.width - 1));
      let y = 1 + Math.floor(index / (squareNum.width - 1));

      const cell = corner3d.floatPtr(i, 0);
      cell[0] = x * 2 - squareNum.width;
      cell[1] = y * 2 - squareNum.height;
      cell[2] = 0;
  }
  obj3ds.push_back(corner3d); // ビュー1個だけ

  const obj2ds = new cv.MatVector();
  obj2ds.push_back(charucoCorners);

  const size = new cv.Size(rgb.cols, rgb.rows);

  const cameraMatrix = new cv.Mat();
  const distCoeffs = new cv.Mat();
  const rvecs = new cv.MatVector();
  const tvecs = new cv.MatVector();
  const intrinsics = new cv.Mat();
  const extrinsics = new cv.Mat();
  const errs = new cv.Mat();
  cv.calibrateCameraExtended(obj3ds, obj2ds, size,
      cameraMatrix, distCoeffs, rvecs, tvecs, intrinsics, extrinsics, errs);
// キャリブレーション結果で原点に軸を描画
  const index = 0;
  cv.drawFrameAxes(rgb, cameraMatrix, distCoeffs, rvecs.get(index), tvecs.get(index), 3);
// 可視化
  cv.imshow('result', rgb);
};

var Module = {
  onRuntimeInitialized: () => {
      const img = new Image();
      img.addEventListener('load', () => {
          act(img);
      });
      img.src = 'board3.jpg';
  }
};

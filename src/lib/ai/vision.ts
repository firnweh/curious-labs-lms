/**
 * MediaPipe Tasks-Vision loaders for the Neural Lab.
 *
 * One shared WASM fileset, lazily resolved, plus a thin factory per task. All
 * models stream from Google's public model CDN on first use, then run fully
 * on-device in the browser (no data leaves the machine). Original Curious Labs
 * code over the open-source @mediapipe/tasks-vision API.
 */
import {
  FilesetResolver,
  FaceDetector,
  FaceLandmarker,
  ObjectDetector,
  PoseLandmarker,
  HandLandmarker,
  GestureRecognizer,
  ImageClassifier,
  ImageEmbedder,
} from "@mediapipe/tasks-vision";

// Pin WASM to the installed package version so runtime + glue stay in lockstep.
const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODELS = "https://storage.googleapis.com/mediapipe-models";

let _fileset: ReturnType<typeof FilesetResolver.forVisionTasks> | null = null;
function fileset() {
  return (_fileset ??= FilesetResolver.forVisionTasks(WASM));
}

export type RunningMode = "IMAGE" | "VIDEO";

export async function loadFaceDetector(runningMode: RunningMode = "VIDEO") {
  return FaceDetector.createFromOptions(await fileset(), {
    baseOptions: {
      modelAssetPath: `${MODELS}/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite`,
      delegate: "GPU",
    },
    runningMode,
  });
}

export async function loadFaceLandmarker(runningMode: RunningMode = "VIDEO") {
  return FaceLandmarker.createFromOptions(await fileset(), {
    baseOptions: {
      modelAssetPath: `${MODELS}/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
      delegate: "GPU",
    },
    runningMode,
    numFaces: 1,
    outputFaceBlendshapes: true,
  });
}

export async function loadObjectDetector(runningMode: RunningMode = "VIDEO") {
  return ObjectDetector.createFromOptions(await fileset(), {
    baseOptions: {
      modelAssetPath: `${MODELS}/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite`,
      delegate: "GPU",
    },
    runningMode,
    scoreThreshold: 0.4,
    maxResults: 6,
  });
}

export async function loadPoseLandmarker(runningMode: RunningMode = "VIDEO") {
  return PoseLandmarker.createFromOptions(await fileset(), {
    baseOptions: {
      modelAssetPath: `${MODELS}/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
      delegate: "GPU",
    },
    runningMode,
    numPoses: 1,
  });
}

export async function loadHandLandmarker(runningMode: RunningMode = "VIDEO") {
  return HandLandmarker.createFromOptions(await fileset(), {
    baseOptions: {
      modelAssetPath: `${MODELS}/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
      delegate: "GPU",
    },
    runningMode,
    numHands: 2,
  });
}

export async function loadGestureRecognizer(runningMode: RunningMode = "VIDEO") {
  return GestureRecognizer.createFromOptions(await fileset(), {
    baseOptions: {
      modelAssetPath: `${MODELS}/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task`,
      delegate: "GPU",
    },
    runningMode,
    numHands: 1,
  });
}

export async function loadImageClassifier(runningMode: RunningMode = "VIDEO") {
  return ImageClassifier.createFromOptions(await fileset(), {
    baseOptions: {
      modelAssetPath: `${MODELS}/image_classifier/efficientnet_lite0/float32/1/efficientnet_lite0.tflite`,
      delegate: "GPU",
    },
    runningMode,
    maxResults: 3,
  });
}

export async function loadImageEmbedder(runningMode: RunningMode = "VIDEO") {
  return ImageEmbedder.createFromOptions(await fileset(), {
    baseOptions: {
      modelAssetPath: `${MODELS}/image_embedder/mobilenet_v3_small/float32/1/mobilenet_v3_small.tflite`,
      delegate: "GPU",
    },
    runningMode,
  });
}

/** Pose skeleton connections (MediaPipe 33-point topology), for overlay drawing. */
export const POSE_CONNECTIONS: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27],
  [24, 26], [26, 28], [27, 29], [27, 31], [28, 30], [28, 32],
];

/** Hand skeleton connections (MediaPipe 21-point topology), for overlay drawing. */
export const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

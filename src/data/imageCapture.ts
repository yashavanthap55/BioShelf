import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import type { CaptureSource, ImageCapture, PickedImage } from '../domain/media';

export class PermissionDeniedError extends Error {}

/**
 * Camera / gallery capture via expo-image-picker. Photos are downsized and
 * re-encoded as JPEG, small enough to store (the web keeps them in the
 * browser's limited localStorage). That copy is too soft for Tesseract, so the
 * web also hands OCR the untouched original.
 */
export class ExpoImageCapture implements ImageCapture {
  readonly supportsCamera = true;

  async pick(source: CaptureSource): Promise<PickedImage | null> {
    const web = Platform.OS === 'web';
    if (!web) {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        throw new PermissionDeniedError(
          source === 'camera' ? 'Camera access was denied' : 'Photo library access was denied',
        );
      }
    }

    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets?.length) return null;

    const asset = result.assets[0];
    const maxSide = web ? 1280 : 1800;
    const context = ImageManipulator.manipulate(asset.uri);
    if (Math.max(asset.width, asset.height) > maxSide) {
      context.resize(asset.width >= asset.height ? { width: maxSide } : { height: maxSide });
    }
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({
      format: SaveFormat.JPEG,
      compress: web ? 0.75 : 0.85,
      base64: web,
    });
    return { uri: saved.uri, base64: saved.base64 ?? undefined, ocrUri: web ? asset.uri : undefined };
  }
}

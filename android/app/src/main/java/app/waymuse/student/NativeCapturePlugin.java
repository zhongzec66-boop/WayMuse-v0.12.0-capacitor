package app.waymuse.student;

import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.provider.MediaStore;
import android.util.Base64;

import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;

/**
 * 原生拍照 / 选图。
 *
 * 为什么要自己写：WebView 的 <input type="file"> 在 Android 上依赖
 * 系统文件选择器，相机返回的大图容易把 WebView OOM 掉（表现为闪退），
 * 而且清单里没有相机权限。这里改成原生 Intent + 降采样后再交给前端。
 */
@CapacitorPlugin(
    name = "NativeCapture",
    permissions = {
        @Permission(strings = { android.Manifest.permission.CAMERA }, alias = "camera")
    }
)
public class NativeCapturePlugin extends Plugin {

    private File pendingFile;

    @PluginMethod
    public void capture(PluginCall call) {
        try {
            File dir = new File(getContext().getCacheDir(), "captures");
            if (!dir.exists() && !dir.mkdirs()) {
                call.reject("无法创建临时目录");
                return;
            }
            pendingFile = new File(dir, "photo-" + System.currentTimeMillis() + ".jpg");
            Uri uri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                pendingFile
            );
            Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            intent.putExtra(MediaStore.EXTRA_OUTPUT, uri);
            intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivityForResult(call, intent, "captureResult");
        } catch (Exception error) {
            call.reject("相机启动失败：" + error.getMessage());
        }
    }

    @PluginMethod
    public void pick(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("image/*");
        startActivityForResult(call, intent, "pickResult");
    }

    @ActivityCallback
    private void captureResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != android.app.Activity.RESULT_OK) {
            call.reject("cancelled");
            return;
        }
        try {
            resolveFromFile(call, pendingFile != null ? pendingFile : null);
        } catch (Exception error) {
            call.reject("读取照片失败：" + error.getMessage());
        }
    }

    @ActivityCallback
    private void pickResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != android.app.Activity.RESULT_OK) {
            call.reject("cancelled");
            return;
        }
        Uri uri = result.getData() != null ? result.getData().getData() : null;
        if (uri == null) {
            call.reject("没有选择图片");
            return;
        }
        try (InputStream input = getContext().getContentResolver().openInputStream(uri)) {
            if (input == null) {
                call.reject("无法读取图片");
                return;
            }
            Bitmap bitmap = decodeScaled(input);
            resolveBitmap(call, bitmap, "picked.jpg");
        } catch (Exception error) {
            call.reject("读取图片失败：" + error.getMessage());
        }
    }

    private void resolveFromFile(PluginCall call, File file) throws Exception {
        if (file == null || !file.exists() || file.length() == 0) {
            call.reject("没有拍到照片");
            return;
        }
        try (InputStream input = new java.io.FileInputStream(file)) {
            Bitmap bitmap = decodeScaled(input);
            resolveBitmap(call, bitmap, file.getName());
        }
    }

    /** 限制长边 1600px：原图动辄 4000px，base64 后几十 MB，必然 OOM */
    private Bitmap decodeScaled(InputStream input) throws Exception {
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        byte[] bytes = readAll(input);
        BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);

        int sample = 1;
        int maxSide = Math.max(bounds.outWidth, bounds.outHeight);
        while (maxSide / sample > 1600) {
            sample *= 2;
        }

        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inSampleSize = sample;
        Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
        if (bitmap == null) throw new Exception("解码失败");

        int longSide = Math.max(bitmap.getWidth(), bitmap.getHeight());
        if (longSide > 1600) {
            float scale = 1600f / longSide;
            Bitmap scaled = Bitmap.createScaledBitmap(
                bitmap,
                Math.round(bitmap.getWidth() * scale),
                Math.round(bitmap.getHeight() * scale),
                true
            );
            if (scaled != bitmap) bitmap.recycle();
            bitmap = scaled;
        }
        return bitmap;
    }

    private byte[] readAll(InputStream input) throws Exception {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        byte[] chunk = new byte[8192];
        int read;
        while ((read = input.read(chunk)) != -1) {
            buffer.write(chunk, 0, read);
        }
        return buffer.toByteArray();
    }

    private void resolveBitmap(PluginCall call, Bitmap bitmap, String name) throws Exception {
        int width = bitmap.getWidth();
        int height = bitmap.getHeight();
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        bitmap.compress(Bitmap.CompressFormat.JPEG, 82, output);
        bitmap.recycle();
        String base64 = Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP);

        // 顺手把压缩后的图落到缓存，前端若想再读文件也有路径
        File dir = new File(getContext().getCacheDir(), "captures");
        if (!dir.exists()) dir.mkdirs();
        File stored = new File(dir, name);
        try (FileOutputStream stream = new FileOutputStream(stored)) {
            stream.write(output.toByteArray());
        }

        JSObject result = new JSObject();
        result.put("dataUrl", "data:image/jpeg;base64," + base64);
        result.put("name", name);
        result.put("width", width);
        result.put("height", height);
        call.resolve(result);
    }
}

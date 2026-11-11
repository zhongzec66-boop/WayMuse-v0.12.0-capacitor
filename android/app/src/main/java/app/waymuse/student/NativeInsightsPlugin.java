package app.waymuse.student;

import android.Manifest;
import android.app.AppOpsManager;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.Process;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 本地状态读取：屏幕使用时间 + 步数。
 *
 * 只在本机读取、只在本机使用；不上传原始明细，只用于让助理知道
 * 「今天刷了多久」「走了几步」，从而能自然地关心或调侃。
 */
@CapacitorPlugin(
    name = "NativeInsights",
    permissions = {
        @Permission(strings = { Manifest.permission.ACTIVITY_RECOGNITION }, alias = "activity")
    }
)
public class NativeInsightsPlugin extends Plugin {

    @PluginMethod
    public void status(PluginCall call) {
        JSObject result = new JSObject();
        result.put("usageAccess", hasUsageAccess());
        result.put("activityPermission", hasActivityPermission());
        result.put("stepsSupported", hasStepSensor());
        call.resolve(result);
    }

    @PluginMethod
    public void openUsageAccessSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("无法打开设置：" + error.getMessage());
        }
    }

    @PluginMethod
    public void requestActivityPermission(PluginCall call) {
        if (hasActivityPermission()) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }
        requestPermissionForAlias("activity", call, "activityPermissionCallback");
    }

    @PermissionCallback
    private void activityPermissionCallback(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", hasActivityPermission());
        call.resolve(result);
    }

    /** 今天的使用时长 + 用得最多的几个 App */
    @PluginMethod
    public void usage(PluginCall call) {
        if (!hasUsageAccess()) {
            call.reject("usage_access_required");
            return;
        }
        try {
            UsageStatsManager manager =
                (UsageStatsManager) getContext().getSystemService(Context.USAGE_STATS_SERVICE);

            Calendar start = Calendar.getInstance();
            start.set(Calendar.HOUR_OF_DAY, 0);
            start.set(Calendar.MINUTE, 0);
            start.set(Calendar.SECOND, 0);
            start.set(Calendar.MILLISECOND, 0);

            List<UsageStats> stats = manager.queryUsageStats(
                UsageStatsManager.INTERVAL_DAILY,
                start.getTimeInMillis(),
                System.currentTimeMillis()
            );

            // 同名包会有多条区间记录，按包名累加
            Map<String, Long> totals = new HashMap<>();
            if (stats != null) {
                for (UsageStats item : stats) {
                    if (item.getTotalTimeInForeground() <= 0) continue;
                    String key = item.getPackageName();
                    totals.put(key, totals.getOrDefault(key, 0L) + item.getTotalTimeInForeground());
                }
            }

            List<Map.Entry<String, Long>> sorted = new ArrayList<>(totals.entrySet());
            Collections.sort(sorted, new Comparator<Map.Entry<String, Long>>() {
                @Override
                public int compare(Map.Entry<String, Long> a, Map.Entry<String, Long> b) {
                    return Long.compare(b.getValue(), a.getValue());
                }
            });

            long total = 0L;
            for (Long value : totals.values()) total += value;

            JSArray apps = new JSArray();
            int count = 0;
            for (Map.Entry<String, Long> entry : sorted) {
                if (count >= 6) break;
                // 过滤自己，否则「WayMuse 用了 2 小时」很怪
                if (entry.getKey().equals(getContext().getPackageName())) continue;
                long minutes = entry.getValue() / 60000L;
                if (minutes < 1) continue;
                JSObject app = new JSObject();
                app.put("package", entry.getKey());
                app.put("label", appLabel(entry.getKey()));
                app.put("minutes", minutes);
                apps.put(app);
                count += 1;
            }

            JSObject result = new JSObject();
            result.put("totalMinutes", total / 60000L);
            result.put("apps", apps);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("读取失败：" + error.getMessage());
        }
    }

    /**
     * 今天步数。
     * 系统计步器给的是「开机以来累计」，这里做差值：
     * 前端把开机累计值和日期一起缓存，跨天/重启后重新取基准。
     */
    @PluginMethod
    public void steps(PluginCall call) {
        if (!hasStepSensor()) {
            call.reject("no_step_sensor");
            return;
        }
        SensorManager sensors =
            (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        Sensor counter = sensors.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        if (counter == null) {
            call.reject("no_step_sensor");
            return;
        }

        final Handler handler = new Handler(Looper.getMainLooper());
        final boolean[] finished = {false};

        SensorEventListener listener = new SensorEventListener() {
            @Override
            public void onSensorChanged(SensorEvent event) {
                if (finished[0] || event.values.length == 0) return;
                finished[0] = true;
                sensors.unregisterListener(this);
                JSObject result = new JSObject();
                result.put("sinceBoot", Math.round(event.values[0]));
                call.resolve(result);
            }

            @Override
            public void onAccuracyChanged(Sensor sensor, int accuracy) {
                // 不需要
            }
        };

        boolean registered = sensors.registerListener(
            listener, counter, SensorManager.SENSOR_DELAY_UI, handler
        );
        if (!registered) {
            call.reject("sensor_unavailable");
            return;
        }

        handler.postDelayed(() -> {
            if (finished[0]) return;
            finished[0] = true;
            sensors.unregisterListener(listener);
            call.reject("sensor_timeout");
        }, 3000);
    }

    private boolean hasUsageAccess() {
        try {
            AppOpsManager appOps =
                (AppOpsManager) getContext().getSystemService(Context.APP_OPS_SERVICE);
            if (appOps == null) return false;
            int mode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                ? appOps.unsafeCheckOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS,
                    Process.myUid(),
                    getContext().getPackageName()
                )
                : appOps.checkOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS,
                    Process.myUid(),
                    getContext().getPackageName()
                );
            return mode == AppOpsManager.MODE_ALLOWED;
        } catch (Exception error) {
            return false;
        }
    }

    private boolean hasActivityPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return true;
        return getContext().checkSelfPermission(Manifest.permission.ACTIVITY_RECOGNITION)
            == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasStepSensor() {
        SensorManager sensors =
            (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        return sensors != null && sensors.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null;
    }

    private String appLabel(String packageName) {
        try {
            PackageManager manager = getContext().getPackageManager();
            ApplicationInfo info = manager.getApplicationInfo(packageName, 0);
            CharSequence label = manager.getApplicationLabel(info);
            return label != null ? label.toString() : packageName;
        } catch (Exception error) {
            return packageName;
        }
    }
}

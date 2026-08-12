import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

let prevTotalJiffies = 0;
let prevIdleJiffies = 0;

/**
 * Format bytes into GiB string
 */
function formatBytes(usedBytes, totalBytes) {
    let usedGiB = (usedBytes / (1024 * 1024 * 1024)).toFixed(1);
    let totalGiB = (totalBytes / (1024 * 1024 * 1024)).toFixed(0);
    // If total rounded to 0, use 1 decimal place
    if (totalGiB === '0') {
        totalGiB = (totalBytes / (1024 * 1024 * 1024)).toFixed(1);
    }
    return `${usedGiB}GiB / ${totalGiB}GiB`;
}

/**
 * Reads Storage usage (Used / Total in GiB)
 */
export function getStorageInfo() {
    try {
        let rootFile = Gio.File.new_for_path('/');
        let info = rootFile.query_filesystem_info('filesystem::*', null);
        let total = info.get_attribute_uint64('filesystem::size');
        let free = info.get_attribute_uint64('filesystem::free');
        let used = total - free;
        if (total > 0) {
            return formatBytes(used, total);
        }
    } catch (e) {
    }

    try {
        let [ok, out] = GLib.spawn_command_line_sync('df -k /');
        if (ok) {
            let text = new TextDecoder().decode(out);
            let lines = text.trim().split('\n');
            if (lines.length >= 2) {
                let parts = lines[lines.length - 1].trim().split(/\s+/);
                // Last line: Filesystem, 1K-blocks, Used, Available...
                let totalKb = parseInt(parts[parts.length - 5] || parts[1], 10);
                let usedKb = parseInt(parts[parts.length - 4] || parts[2], 10);
                if (!isNaN(totalKb) && !isNaN(usedKb)) {
                    return formatBytes(usedKb * 1024, totalKb * 1024);
                }
            }
        }
    } catch (e) {
    }

    return 'N/A';
}

/**
 * Reads RAM usage (Used / Total in GiB)
 */
export function getRamInfo() {
    try {
        let [ok, contents] = GLib.file_get_contents('/proc/meminfo');
        if (!ok) return 'N/A';
        let text = new TextDecoder().decode(contents);
        let totalMatch = text.match(/MemTotal:\s+(\d+)\s+kB/);
        let availMatch = text.match(/MemAvailable:\s+(\d+)\s+kB/);
        if (totalMatch && availMatch) {
            let totalKb = parseInt(totalMatch[1], 10);
            let availKb = parseInt(availMatch[1], 10);
            let usedKb = totalKb - availKb;
            
            let usedGiB = (usedKb / (1024 * 1024)).toFixed(2);
            let totalGiB = (totalKb / (1024 * 1024)).toFixed(1);
            return `${usedGiB}GiB / ${totalGiB}GiB`;
        }
    } catch (e) {
    }
    return 'N/A';
}

/**
 * Reads live CPU usage percentage (%)
 */
export function getCpuUsage() {
    try {
        let [ok, contents] = GLib.file_get_contents('/proc/stat');
        if (!ok) return '0%';
        let text = new TextDecoder().decode(contents);
        let firstLine = text.split('\n')[0];
        let parts = firstLine.trim().split(/\s+/).slice(1).map(Number);
        
        if (parts.length >= 4) {
            let idle = parts[3] + (parts[4] || 0); // idle + iowait
            let total = parts.reduce((acc, val) => acc + val, 0);
            
            let diffTotal = total - prevTotalJiffies;
            let diffIdle = idle - prevIdleJiffies;
            
            prevTotalJiffies = total;
            prevIdleJiffies = idle;
            
            if (diffTotal <= 0) return '0%';
            let usage = Math.round(100 * (diffTotal - diffIdle) / diffTotal);
            return `${Math.max(0, Math.min(100, usage))}%`;
        }
    } catch (e) {
    }
    return '0%';
}

/**
 * Reads CPU Temperature in °C
 */
export function getCpuTemp() {
    let thermalPaths = [
        '/sys/class/thermal/thermal_zone0/temp',
        '/sys/class/thermal/thermal_zone1/temp',
        '/sys/class/hwmon/hwmon0/temp1_input',
        '/sys/class/hwmon/hwmon1/temp1_input',
        '/sys/class/hwmon/hwmon2/temp1_input'
    ];

    for (let path of thermalPaths) {
        try {
            let [ok, contents] = GLib.file_get_contents(path);
            if (ok) {
                let text = new TextDecoder().decode(contents).trim();
                let rawTemp = parseInt(text, 10);
                if (!isNaN(rawTemp) && rawTemp > 0) {
                    let tempC = rawTemp > 1000 ? Math.round(rawTemp / 1000) : rawTemp;
                    return `${tempC}°C`;
                }
            }
        } catch (e) {
        }
    }
    return 'N/A';
}

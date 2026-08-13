import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import * as SysInfo from './sysinfo.js';

export default class DeskGlowExtension extends Extension {
    enable() {
        this._settings = this.getSettings('org.gnome.shell.extensions.deskglow');
        this._settingsSignals = [];
        this._stageEventId = null;
        this._dragging = false;
        this._lastAppliedX = -1;
        this._lastAppliedY = -1;

        // Main Container Widget
        this._container = new St.BoxLayout({
            name: 'deskglow-container',
            style_class: 'deskglow-container',
            vertical: true,
            reactive: true,
            track_hover: true,
            x_expand: false,
            y_expand: false
        });

        // 1. Time Row (Hours:Minutes + AM/PM)
        this._timeBox = new St.BoxLayout({
            style_class: 'deskglow-time-box',
            vertical: false,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.END
        });

        this._timeLabel = new St.Label({
            style_class: 'deskglow-time-text',
            text: '00:00'
        });

        this._ampmLabel = new St.Label({
            style_class: 'deskglow-ampm-text',
            text: ''
        });

        this._timeBox.add_child(this._timeLabel);
        this._timeBox.add_child(this._ampmLabel);
        this._container.add_child(this._timeBox);

        // 2. Date Row (Day Month Year Weekday)
        this._dateBox = new St.BoxLayout({
            style_class: 'deskglow-date-box',
            vertical: false,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.CENTER
        });

        this._dateDayNumLabel = new St.Label({
            style_class: 'deskglow-date-day-num',
            text: '12'
        });

        this._dateMonthYearLabel = new St.Label({
            style_class: 'deskglow-date-month-year',
            text: 'August 2026'
        });

        this._dateWeekdayLabel = new St.Label({
            style_class: 'deskglow-date-weekday',
            text: 'Wednesday'
        });

        this._dateBox.add_child(this._dateDayNumLabel);
        this._dateBox.add_child(this._dateMonthYearLabel);
        this._dateBox.add_child(this._dateWeekdayLabel);
        this._container.add_child(this._dateBox);

        // 3. Horizontal Separator
        this._separator = new St.Widget({
            style_class: 'deskglow-separator',
            x_expand: true
        });
        this._container.add_child(this._separator);

        // 4. System Stats Row (Tall Vertical Line Dividers matching Target Image 2)
        this._statsBox = new St.BoxLayout({
            style_class: 'deskglow-stats-box',
            vertical: false,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.FILL
        });

        this._statIcons = [];
        this._statTitleLabels = [];
        this._statValueLabels = [];

        this._storageValue = this._createStatItem('STORAGE', 'storage.svg', false);
        this._ramValue = this._createStatItem('RAM', 'ram.svg', false);
        this._cpuValue = this._createStatItem('CPU', 'cpu.svg', false);
        this._tempValue = this._createStatItem('TEMP', 'temp.svg', true);

        this._container.add_child(this._statsBox);

        this._ensureLayering();

        // Retry layering after 2 seconds to ensure DING and window_group are fully loaded
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
            this._ensureLayering();
            return GLib.SOURCE_REMOVE;
        });

        // Enable Drag & Drop
        this._setupDragging();

        // Connect GSettings changed listeners
        let keysToWatch = [
            'show-background',
            'bg-opacity',
            'shadow-type',
            'shadow-blur',
            'shadow-opacity',
            'time-font-size',
            'date-font-size',
            'stats-font-size',
            'stats-icon-size',
            'lock-position',
            'position-x',
            'position-y',
            'use-24h',
            'show-seconds'
        ];

        for (let key of keysToWatch) {
            let sigId = this._settings.connect(`changed::${key}`, () => {
                this._applySettings();
                this._updateClockAndStats();
            });
            this._settingsSignals.push(sigId);
        }

        // Apply initial visual settings & position
        this._applySettings();

        // Initial Stats Update & Timer Setup
        this._updateClockAndStats();
        let interval = this._settings.get_int('update-interval') || 1000;
        this._timerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, interval, () => {
            this._updateClockAndStats();
            return GLib.SOURCE_CONTINUE;
        });

        // Set initial position
        this._restorePosition();
    }

    _createStatItem(labelTitle, iconFilename, isLast) {
        let itemBox = new St.BoxLayout({
            style_class: isLast ? 'deskglow-stat-item-last' : 'deskglow-stat-item',
            vertical: false,
            y_align: Clutter.ActorAlign.CENTER
        });

        // Icon
        let iconPath = this.path + '/icons/' + iconFilename;
        let iconFile = Gio.File.new_for_path(iconPath);
        let gicon = new Gio.FileIcon({ file: iconFile });
        let iconWidget = new St.Icon({
            gicon: gicon,
            style_class: 'deskglow-stat-icon',
            icon_size: 22,
            y_align: Clutter.ActorAlign.CENTER
        });
        this._statIcons.push(iconWidget);

        // Vertical label + value box
        let detailsBox = new St.BoxLayout({
            style_class: 'deskglow-stat-details',
            vertical: true,
            y_align: Clutter.ActorAlign.CENTER
        });

        let titleLabel = new St.Label({
            style_class: 'deskglow-stat-label',
            text: labelTitle
        });
        this._statTitleLabels.push(titleLabel);

        let valueLabel = new St.Label({
            style_class: 'deskglow-stat-value',
            text: '--'
        });
        this._statValueLabels.push(valueLabel);

        detailsBox.add_child(titleLabel);
        detailsBox.add_child(valueLabel);

        itemBox.add_child(iconWidget);
        itemBox.add_child(detailsBox);

        this._statsBox.add_child(itemBox);

        // Add explicit 1px tall vertical line divider between items
        if (!isLast) {
            let vSep = new St.Widget({
                style_class: 'deskglow-v-separator',
                y_expand: true,
                y_align: Clutter.ActorAlign.FILL
            });
            this._statsBox.add_child(vSep);
        }

        return valueLabel;
    }

    _ensureLayering() {
        if (!this._container) return;

        if (this._container.get_parent()) {
            this._container.get_parent().remove_child(this._container);
        }

        // Place ABOVE all windows so it's not hidden by DING
        if (global.window_group && Main.uiGroup.contains(global.window_group)) {
            Main.uiGroup.insert_child_above(this._container, global.window_group);
        } else {
            Main.layoutManager.addChrome(this._container, { trackFullscreen: false });
        }

        // Start smart hide polling
        if (!this._overlapTimeoutId) {
            this._overlapTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => this._checkOverlap());
        }
    }

    _checkOverlap() {
        if (!this._container || !this._container.get_parent() || this._dragging) {
            return GLib.SOURCE_CONTINUE;
        }

        let widgetBox = this._container.get_allocation_box();
        let overlapping = false;
        let actors = global.get_window_actors();
        
        for (let actor of actors) {
            let metaWin = actor.get_meta_window();
            
            if (metaWin.get_window_type() === Meta.WindowType.DESKTOP) continue;
            if (metaWin.is_hidden() || metaWin.is_minimized()) continue;
            
            let workspaceManager = global.workspace_manager;
            if (!metaWin.is_on_all_workspaces() && metaWin.get_workspace() !== workspaceManager.get_active_workspace()) continue;

            let frame = metaWin.get_frame_rect();
            if (frame.x < widgetBox.x2 && frame.x + frame.width > widgetBox.x1 &&
                frame.y < widgetBox.y2 && frame.y + frame.height > widgetBox.y1) {
                overlapping = true;
                break;
            }
        }

        if (overlapping && this._container.opacity !== 0) {
            this._container.ease({ opacity: 0, duration: 200, mode: Clutter.AnimationMode.EASE_OUT_QUAD });
        } else if (!overlapping && this._container.opacity === 0) {
            this._container.ease({ opacity: 255, duration: 200, mode: Clutter.AnimationMode.EASE_IN_QUAD });
        }
        
        return GLib.SOURCE_CONTINUE;
    }

    _applySettings() {
        if (!this._container) return;

        // 1. Background & Opacity
        let showBg = this._settings.get_boolean('show-background');
        let bgOpacity = this._settings.get_double('bg-opacity');
        if (isNaN(bgOpacity)) bgOpacity = 0.85;

        if (!showBg) {
            this._container.set_style('background-color: transparent !important; border-color: transparent !important;');
        } else {
            let r = 10, g = 11, b = 14;
            let borderOpacity = (0.12 * bgOpacity).toFixed(2);
            this._container.set_style(
                `background-color: rgba(${r}, ${g}, ${b}, ${bgOpacity.toFixed(2)}); ` +
                `border: 1px solid rgba(255, 255, 255, ${borderOpacity});`
            );
        }

        // 2. Crisp Font Sizing per Component
        let timeSize = this._settings.get_int('time-font-size') || 96;
        let dateSize = this._settings.get_int('date-font-size') || 34;
        let statsSize = this._settings.get_int('stats-font-size') || 12;
        let iconSize = this._settings.get_int('stats-icon-size') || 22;

        let ampmSize = Math.max(16, Math.round(timeSize * 0.27));
        let monthSize = Math.max(16, Math.round(dateSize * 0.76));
        let statTitleSize = Math.max(8, Math.round(statsSize * 0.82));

        // 3. Shadow Control (Type, Blur, Opacity)
        let shadowType = this._settings.get_string('shadow-type') || 'glow';
        let blur = this._settings.get_int('shadow-blur');
        if (isNaN(blur) || blur < 0) blur = 12;
        let shadowOpacity = this._settings.get_double('shadow-opacity');
        if (isNaN(shadowOpacity)) shadowOpacity = 0.75;

        let textShadowCss = '';
        if (shadowType === 'glow') {
            textShadowCss = `text-shadow: 0px 0px ${blur}px rgba(255, 255, 255, ${shadowOpacity.toFixed(2)});`;
        } else if (shadowType === 'dark') {
            textShadowCss = `text-shadow: 2px 2px ${blur}px rgba(0, 0, 0, ${shadowOpacity.toFixed(2)});`;
        } else if (shadowType === 'outline') {
            let op = shadowOpacity.toFixed(2);
            textShadowCss = `text-shadow: -1px -1px 0px rgba(0,0,0,${op}), 1px -1px 0px rgba(0,0,0,${op}), -1px 1px 0px rgba(0,0,0,${op}), 1px 1px 0px rgba(0,0,0,${op});`;
        } else {
            textShadowCss = 'text-shadow: none;';
        }

        // APPLY TEXT SHADOW & SIZING TO ALL LABELS
        this._timeLabel.set_style(`font-size: ${timeSize}px; ${textShadowCss}`);
        this._ampmLabel.set_style(`font-size: ${ampmSize}px; ${textShadowCss}`);

        this._dateDayNumLabel.set_style(`font-size: ${dateSize}px; ${textShadowCss}`);
        this._dateMonthYearLabel.set_style(`font-size: ${monthSize}px; ${textShadowCss}`);
        this._dateWeekdayLabel.set_style(`font-size: ${dateSize}px; ${textShadowCss}`);

        for (let label of this._statTitleLabels) {
            label.set_style(`font-size: ${statTitleSize}px; ${textShadowCss}`);
        }

        for (let label of this._statValueLabels) {
            label.set_style(`font-size: ${statsSize}px; ${textShadowCss}`);
        }

        // DYNAMIC ICON RESIZING
        for (let icon of this._statIcons) {
            icon.set_icon_size(iconSize);
            icon.set_style(`width: ${iconSize}px; height: ${iconSize}px;`);
        }

        // 4. Update Position from Settings if not actively dragging
        if (!this._dragging) {
            let posX = this._settings.get_int('position-x');
            let posY = this._settings.get_int('position-y');
            this._updateWidgetPosition(posX, posY);
        }
    }

    _updateWidgetPosition(posX, posY) {
        let primaryMonitor = Main.layoutManager.primaryMonitor;
        if (!primaryMonitor || !this._container) return;

        let monX = primaryMonitor.x;
        let monY = primaryMonitor.y;
        let monW = primaryMonitor.width;
        let monH = primaryMonitor.height;

        let [minW, natW] = this._container.get_preferred_width(-1);
        let [minH, natH] = this._container.get_preferred_height(-1);

        let widgetWidth = (natW && natW > 100) ? natW : (this._container.width || 420);
        let widgetHeight = (natH && natH > 50) ? natH : (this._container.height || 180);

        let marginX = 40;
        let marginY = 50;
        let taskbarOffset = 70;

        let targetX = monX + monW - widgetWidth - marginX;
        let targetY = monY + monH - widgetHeight - taskbarOffset;

        if (posX === -11) { // Bottom Left
            targetX = monX + marginX;
            targetY = monY + monH - widgetHeight - taskbarOffset;
        } else if (posX === -12) { // Top Right
            targetX = monX + monW - widgetWidth - marginX;
            targetY = monY + marginY;
        } else if (posX === -13) { // Top Left
            targetX = monX + marginX;
            targetY = monY + marginY;
        } else if (posX === -14) { // Center
            targetX = monX + Math.round((monW - widgetWidth) / 2);
            targetY = monY + Math.round((monH - widgetHeight) / 2);
        } else if (posX >= 0 && posY >= 0) { // Custom Pixel position
            targetX = posX;
            targetY = posY;
        } // Default (-1 or -10) is Bottom Right

        // Safe Clamping inside screen boundaries
        let maxX = Math.max(10, monX + monW - widgetWidth - 10);
        let maxY = Math.max(10, monY + monH - widgetHeight - 10);

        let finalX = Math.min(maxX, Math.max(monX + 10, Math.round(targetX)));
        let finalY = Math.min(maxY, Math.max(monY + 10, Math.round(targetY)));

        this._container.set_position(finalX, finalY);

        if (this._lastAppliedX === finalX && this._lastAppliedY === finalY) {
            return;
        }

        this._lastAppliedX = finalX;
        this._lastAppliedY = finalY;

        if (posX !== finalX) {
            this._settings.set_int('position-x', finalX);
        }
        if (posY !== finalY) {
            this._settings.set_int('position-y', finalY);
        }
    }

    _updateClockAndStats() {
        let now = GLib.DateTime.new_now_local();
        let use24h = this._settings.get_boolean('use-24h');
        let showSec = this._settings.get_boolean('show-seconds');

        // Time format
        let timeFormat = use24h ? (showSec ? '%H:%M:%S' : '%H:%M') : (showSec ? '%I:%M:%S' : '%I:%M');
        let timeStr = now.format(timeFormat);
        
        // Remove leading zero for 12h format
        if (!use24h && timeStr.startsWith('0')) {
            timeStr = timeStr.substring(1);
        }

        let ampmStr = use24h ? '' : now.format('%p');

        this._timeLabel.set_text(timeStr);
        this._ampmLabel.set_text(ampmStr);

        // Date format
        this._dateDayNumLabel.set_text(now.format('%e').trim());
        this._dateMonthYearLabel.set_text(now.format('%B %Y'));
        this._dateWeekdayLabel.set_text(now.format('%A'));

        // System Stats
        this._storageValue.set_text(SysInfo.getStorageInfo());
        this._ramValue.set_text(SysInfo.getRamInfo());
        this._cpuValue.set_text(SysInfo.getCpuUsage());
        this._tempValue.set_text(SysInfo.getCpuTemp());
    }

    _setupDragging() {
        this._dragging = false;
        this._dragStartX = 0;
        this._dragStartY = 0;
        this._widgetStartX = 0;
        this._widgetStartY = 0;

        this._container.connect('button-press-event', (actor, event) => {
            if (event.get_button() !== 1) return Clutter.EVENT_PROPAGATE;
            if (this._settings.get_boolean('lock-position')) return Clutter.EVENT_PROPAGATE;

            this._dragging = true;
            let [stageX, stageY] = event.get_coords();
            this._dragStartX = stageX;
            this._dragStartY = stageY;
            this._widgetStartX = this._container.x;
            this._widgetStartY = this._container.y;

            // Connect captured-event on global stage to follow mouse motion everywhere
            if (this._stageEventId) {
                global.stage.disconnect(this._stageEventId);
            }

            this._stageEventId = global.stage.connect('captured-event', (stage, evt) => {
                let type = evt.type();
                if (type === Clutter.EventType.MOTION) {
                    let [curX, curY] = evt.get_coords();
                    let deltaX = curX - this._dragStartX;
                    let deltaY = curY - this._dragStartY;

                    let newX = Math.round(this._widgetStartX + deltaX);
                    let newY = Math.round(this._widgetStartY + deltaY);

                    this._container.set_position(newX, newY);
                    return Clutter.EVENT_STOP;
                } else if (type === Clutter.EventType.BUTTON_RELEASE && evt.get_button() === 1) {
                    this._stopDragging();
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            });

            return Clutter.EVENT_STOP;
        });
    }

    _stopDragging() {
        if (this._stageEventId) {
            global.stage.disconnect(this._stageEventId);
            this._stageEventId = null;
        }
        if (this._dragging) {
            this._dragging = false;
            let posX = Math.round(this._container.x);
            let posY = Math.round(this._container.y);
            this._settings.set_int('position-x', posX);
            this._settings.set_int('position-y', posY);
        }
    }

    _restorePosition() {
        let posX = this._settings.get_int('position-x');
        let posY = this._settings.get_int('position-y');
        this._updateWidgetPosition(posX, posY);
    }

    disable() {
        this._stopDragging();

        if (this._overlapTimeoutId) {
            GLib.source_remove(this._overlapTimeoutId);
            this._overlapTimeoutId = null;
        }

        if (this._updateTimer) {
            GLib.source_remove(this._updateTimer);
            this._updateTimer = null;
        }

        if (this._timerId) {
            GLib.source_remove(this._timerId);
            this._timerId = null;
        }

        if (this._settingsSignals && this._settings) {
            for (let id of this._settingsSignals) {
                this._settings.disconnect(id);
            }
            this._settingsSignals = [];
        }

        if (this._container) {
            let parent = this._container.get_parent();
            if (parent) {
                parent.remove_child(this._container);
            }
            this._container.destroy();
            this._container = null;
        }

        this._settings = null;
    }
}

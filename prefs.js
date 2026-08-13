import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';

export default class DeskGlowPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        window.set_default_size(660, 680);
        let settings = this.getSettings('org.gnome.shell.extensions.deskglow');

        // ==========================================
        // TAB 1: APPEARANCE & STYLING
        // ==========================================
        let pageAppearance = new Adw.PreferencesPage({
            title: _('Appearance'),
            icon_name: 'preferences-desktop-theme-symbolic',
        });
        window.add(pageAppearance);

        // Group 1: Background Container
        let groupBg = new Adw.PreferencesGroup({
            title: _('Background Container'),
            description: _('Customize background box visibility and opacity'),
        });
        pageAppearance.add(groupBg);

        // Show Background Box Switch
        let showBgRow = new Adw.SwitchRow({
            title: _('Show Background Box'),
            subtitle: _('Display dark translucent container box behind widget'),
        });
        groupBg.add(showBgRow);
        settings.bind('show-background', showBgRow, 'active', Gio.SettingsBindFlags.DEFAULT);

        // Background Opacity Scale
        let bgOpacityRow = new Adw.ActionRow({
            title: _('Background Opacity'),
            subtitle: _('Adjust transparency level (0% transparent to 100% solid)'),
        });
        let bgScale = Gtk.Scale.new_with_range(Gtk.Orientation.HORIZONTAL, 0.0, 1.0, 0.05);
        bgScale.set_draw_value(true);
        bgScale.set_value_pos(Gtk.PositionType.RIGHT);
        bgScale.set_hexpand(true);
        bgScale.set_size_request(160, -1);
        bgScale.set_value(settings.get_double('bg-opacity'));
        bgScale.connect('value-changed', (w) => {
            settings.set_double('bg-opacity', w.get_value());
        });
        bgOpacityRow.add_suffix(bgScale);
        groupBg.add(bgOpacityRow);

        // Group 2: Shadow and Glow Controls
        let groupShadow = new Adw.PreferencesGroup({
            title: _('Text Shadow and Glow Controls'),
            description: _('Customize shadow style, blur softness, and opacity (Applies to all text)'),
        });
        pageAppearance.add(groupShadow);

        // Shadow Style ComboRow
        let shadowTypes = ['glow', 'dark', 'outline', 'none'];
        let shadowTypeNames = [
            _('Outer White Glow (Target Image)'),
            _('Dark Drop Shadow'),
            _('Crisp Outline'),
            _('None (No Shadow)')
        ];

        let shadowTypeRow = new Adw.ComboRow({
            title: _('Text Shadow Type'),
            subtitle: _('Choose visual glow/shadow effect for all text'),
            model: Gtk.StringList.new(shadowTypeNames),
        });

        let currentType = settings.get_string('shadow-type') || 'glow';
        let initialIdx = shadowTypes.indexOf(currentType);
        if (initialIdx >= 0) shadowTypeRow.set_selected(initialIdx);

        shadowTypeRow.connect('notify::selected', (row) => {
            let idx = row.get_selected();
            if (idx >= 0 && idx < shadowTypes.length) {
                settings.set_string('shadow-type', shadowTypes[idx]);
            }
        });
        groupShadow.add(shadowTypeRow);

        // Shadow Blur Scale
        let shadowBlurRow = new Adw.ActionRow({
            title: _('Shadow Blur Radius (px)'),
            subtitle: _('Adjust blur softness radius (0px sharp to 30px soft)'),
        });
        let blurScale = Gtk.Scale.new_with_range(Gtk.Orientation.HORIZONTAL, 0, 30, 1);
        blurScale.set_draw_value(true);
        blurScale.set_value_pos(Gtk.PositionType.RIGHT);
        blurScale.set_hexpand(true);
        blurScale.set_size_request(160, -1);
        blurScale.set_value(settings.get_int('shadow-blur'));
        blurScale.connect('value-changed', (w) => {
            settings.set_int('shadow-blur', Math.round(w.get_value()));
        });
        shadowBlurRow.add_suffix(blurScale);
        groupShadow.add(shadowBlurRow);

        // Shadow Opacity Scale
        let shadowOpacityRow = new Adw.ActionRow({
            title: _('Shadow Opacity'),
            subtitle: _('Adjust intensity and opacity of shadow'),
        });
        let opacityScale = Gtk.Scale.new_with_range(Gtk.Orientation.HORIZONTAL, 0.0, 1.0, 0.05);
        opacityScale.set_draw_value(true);
        opacityScale.set_value_pos(Gtk.PositionType.RIGHT);
        opacityScale.set_hexpand(true);
        opacityScale.set_size_request(160, -1);
        opacityScale.set_value(settings.get_double('shadow-opacity'));
        opacityScale.connect('value-changed', (w) => {
            settings.set_double('shadow-opacity', w.get_value());
        });
        shadowOpacityRow.add_suffix(opacityScale);
        groupShadow.add(shadowOpacityRow);


        // ==========================================
        // TAB 2: SIZES & FORMAT
        // ==========================================
        let pageSizes = new Adw.PreferencesPage({
            title: _('Sizes and Format'),
            icon_name: 'preferences-desktop-font-symbolic',
        });
        window.add(pageSizes);

        // Group 1: Component Sizes
        let groupSizes = new Adw.PreferencesGroup({
            title: _('Individual Component Sizes'),
            description: _('Adjust exact font and icon sizes per component'),
        });
        pageSizes.add(groupSizes);

        // Time Font Size
        let timeSizeRow = new Adw.ActionRow({
            title: _('Clock Time Size (px)'),
        });
        let timeScale = Gtk.Scale.new_with_range(Gtk.Orientation.HORIZONTAL, 48, 140, 2);
        timeScale.set_draw_value(true);
        timeScale.set_value_pos(Gtk.PositionType.RIGHT);
        timeScale.set_hexpand(true);
        timeScale.set_size_request(160, -1);
        timeScale.set_value(settings.get_int('time-font-size'));
        timeScale.connect('value-changed', (w) => {
            settings.set_int('time-font-size', Math.round(w.get_value()));
        });
        timeSizeRow.add_suffix(timeScale);
        groupSizes.add(timeSizeRow);

        // Date Font Size
        let dateSizeRow = new Adw.ActionRow({
            title: _('Date Text Size (px)'),
        });
        let dateScale = Gtk.Scale.new_with_range(Gtk.Orientation.HORIZONTAL, 20, 50, 1);
        dateScale.set_draw_value(true);
        dateScale.set_value_pos(Gtk.PositionType.RIGHT);
        dateScale.set_hexpand(true);
        dateScale.set_size_request(160, -1);
        dateScale.set_value(settings.get_int('date-font-size'));
        dateScale.connect('value-changed', (w) => {
            settings.set_int('date-font-size', Math.round(w.get_value()));
        });
        dateSizeRow.add_suffix(dateScale);
        groupSizes.add(dateSizeRow);

        // Stats Value Size
        let statsSizeRow = new Adw.ActionRow({
            title: _('System Stats Text Size (px)'),
        });
        let statsScale = Gtk.Scale.new_with_range(Gtk.Orientation.HORIZONTAL, 9, 20, 1);
        statsScale.set_draw_value(true);
        statsScale.set_value_pos(Gtk.PositionType.RIGHT);
        statsScale.set_hexpand(true);
        statsScale.set_size_request(160, -1);
        statsScale.set_value(settings.get_int('stats-font-size'));
        statsScale.connect('value-changed', (w) => {
            settings.set_int('stats-font-size', Math.round(w.get_value()));
        });
        statsSizeRow.add_suffix(statsScale);
        groupSizes.add(statsSizeRow);

        // Stats Icon Size
        let iconSizeRow = new Adw.ActionRow({
            title: _('System Stats Icon Size (px)'),
        });
        let iconScale = Gtk.Scale.new_with_range(Gtk.Orientation.HORIZONTAL, 16, 40, 1);
        iconScale.set_draw_value(true);
        iconScale.set_value_pos(Gtk.PositionType.RIGHT);
        iconScale.set_hexpand(true);
        iconScale.set_size_request(160, -1);
        iconScale.set_value(settings.get_int('stats-icon-size'));
        iconScale.connect('value-changed', (w) => {
            settings.set_int('stats-icon-size', Math.round(w.get_value()));
        });
        iconSizeRow.add_suffix(iconScale);
        groupSizes.add(iconSizeRow);

        // Group 2: Clock and Date Format
        let groupClock = new Adw.PreferencesGroup({
            title: _('Clock and Date Format'),
        });
        pageSizes.add(groupClock);

        // 24-Hour Format
        let use24hRow = new Adw.SwitchRow({
            title: _('24-Hour Format'),
            subtitle: _('Display 14:46 instead of 02:46 PM'),
        });
        groupClock.add(use24hRow);
        settings.bind('use-24h', use24hRow, 'active', Gio.SettingsBindFlags.DEFAULT);

        // Show Seconds
        let showSecRow = new Adw.SwitchRow({
            title: _('Show Seconds'),
            subtitle: _('Display live seconds in the digital clock'),
        });
        groupClock.add(showSecRow);
        settings.bind('show-seconds', showSecRow, 'active', Gio.SettingsBindFlags.DEFAULT);


        // ==========================================
        // TAB 3: POSITION & RESET
        // ==========================================
        let pagePosition = new Adw.PreferencesPage({
            title: _('Position and Reset'),
            icon_name: 'preferences-desktop-display-symbolic',
        });
        window.add(pagePosition);

        // Group 1: Position Controls
        let groupPosition = new Adw.PreferencesGroup({
            title: _('Position and Drag Controls'),
            description: _('Manage desktop position coordinates and drag lock'),
        });
        pagePosition.add(groupPosition);

        // Lock Position
        let lockPosRow = new Adw.SwitchRow({
            title: _('Lock Position'),
            subtitle: _('Lock position to prevent accidental mouse dragging on desktop'),
        });
        groupPosition.add(lockPosRow);
        settings.bind('lock-position', lockPosRow, 'active', Gio.SettingsBindFlags.DEFAULT);

        // Position X
        let posXRow = new Adw.ActionRow({
            title: _('Horizontal Position (X px)'),
        });
        let posXSpin = Gtk.SpinButton.new_with_range(-100, 3840, 10);
        posXSpin.set_valign(Gtk.Align.CENTER);
        posXSpin.set_value(settings.get_int('position-x'));
        posXSpin.connect('value-changed', (w) => {
            let val = Math.round(w.get_value());
            if (val >= 0 && settings.get_int('position-x') !== val) {
                settings.set_int('position-x', val);
            }
        });
        posXRow.add_suffix(posXSpin);
        groupPosition.add(posXRow);

        // Position Y
        let posYRow = new Adw.ActionRow({
            title: _('Vertical Position (Y px)'),
        });
        let posYSpin = Gtk.SpinButton.new_with_range(-100, 2160, 10);
        posYSpin.set_valign(Gtk.Align.CENTER);
        posYSpin.set_value(settings.get_int('position-y'));
        posYSpin.connect('value-changed', (w) => {
            let val = Math.round(w.get_value());
            if (val >= 0 && settings.get_int('position-y') !== val) {
                settings.set_int('position-y', val);
            }
        });
        posYRow.add_suffix(posYSpin);
        groupPosition.add(posYRow);

        // Keep SpinButtons in sync if position changes
        let sigX = settings.connect('changed::position-x', () => {
            let val = settings.get_int('position-x');
            if (val >= 0 && posXSpin.get_value() !== val) posXSpin.set_value(val);
        });
        let sigY = settings.connect('changed::position-y', () => {
            let val = settings.get_int('position-y');
            if (val >= 0 && posYSpin.get_value() !== val) posYSpin.set_value(val);
        });

        window.connect('destroy', () => {
            settings.disconnect(sigX);
            settings.disconnect(sigY);
        });

        // Group 2: Presets (Dynamic Math per Monitor)
        let groupPresets = new Adw.PreferencesGroup({
            title: _('Preset Screen Positions'),
            description: _('Quickly align widget to screen corners or center dynamically'),
        });
        pagePosition.add(groupPresets);

        let presetMainBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 12,
            margin_end: 12,
        });

        let boxPresets = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            homogeneous: true,
            halign: Gtk.Align.FILL,
        });

        let presets = [
            { label: _('Bottom Right'), code: -10 },
            { label: _('Bottom Left'), code: -11 },
            { label: _('Top Right'), code: -12 },
            { label: _('Top Left'), code: -13 },
            { label: _('Center'), code: -14 }
        ];

        for (let p of presets) {
            let btn = new Gtk.Button({ label: p.label });
            btn.connect('clicked', () => {
                settings.set_int('position-x', p.code);
            });
            boxPresets.append(btn);
        }

        presetMainBox.append(boxPresets);
        groupPresets.add(presetMainBox);

        // Group 3: Reset Options
        let groupReset = new Adw.PreferencesGroup({
            title: _('Reset Options'),
        });
        pagePosition.add(groupReset);

        let resetRow = new Adw.ActionRow({
            title: _('Reset All Settings to Default'),
            subtitle: _('Restore default fonts, sizes, shadow, background, and desktop position'),
        });

        let resetBtn = new Gtk.Button({
            label: _('Reset to Default'),
            valign: Gtk.Align.CENTER,
            css_classes: ['destructive-action'],
        });

        resetBtn.connect('clicked', () => {
            let keysToReset = [
                'position-x',
                'position-y',
                'lock-position',
                'use-24h',
                'show-seconds',
                'show-background',
                'bg-opacity',
                'shadow-type',
                'shadow-blur',
                'shadow-opacity',
                'time-font-size',
                'date-font-size',
                'stats-font-size',
                'stats-icon-size'
            ];
            for (let k of keysToReset) {
                settings.reset(k);
            }

            // Sync GUI controls
            bgScale.set_value(settings.get_double('bg-opacity'));
            blurScale.set_value(settings.get_int('shadow-blur'));
            opacityScale.set_value(settings.get_double('shadow-opacity'));
            timeScale.set_value(settings.get_int('time-font-size'));
            dateScale.set_value(settings.get_int('date-font-size'));
            statsScale.set_value(settings.get_int('stats-font-size'));
            iconScale.set_value(settings.get_int('stats-icon-size'));
            shadowTypeRow.set_selected(0);

            // Trigger Bottom Right recalculation
            settings.set_int('position-x', -10);
        });

        resetRow.add_suffix(resetBtn);
        groupReset.add(resetRow);
    }
}


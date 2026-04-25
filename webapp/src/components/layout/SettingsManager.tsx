import React, { useState } from 'react';

interface SettingsManagerProps {
    status: any;
    onRefresh: () => void;
    API: any;
}

export const SettingsManager: React.FC<SettingsManagerProps> = ({ status, onRefresh, API }) => {
    const [saving, setSaving] = useState(false);

    const handleToggleMqtt = async (enabled: boolean) => {
        setSaving(true);
        try {
            await API.updateSettings({ mqtt_enabled: enabled });
            onRefresh();
        } catch (e) {
            console.error("Failed to update MQTT settings", e);
        } finally {
            setSaving(false);
        }
    };

    const handleToggleScreensaver = async (enabled: boolean) => {
        setSaving(true);
        try {
            await API.updateSettings({ ss_enabled: enabled });
            onRefresh();
        } catch (e) {
            console.error("Failed to update Screensaver settings", e);
        } finally {
            setSaving(false);
        }
    };

    const handleToggleAP = async (enabled: boolean) => {
        setSaving(true);
        try {
            await API.updateSettings({ always_on: enabled });
            onRefresh();
        } catch (e) {
            console.error("Failed to update AP settings", e);
        } finally {
            setSaving(false);
        }
    };

    const s: Record<string, React.CSSProperties> = {
        card: { background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' },
        row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid #f1f5f9' },
        label: { fontSize: '14px', fontWeight: 700, color: '#1e293b' },
        desc: { fontSize: '12px', color: '#64748b', marginTop: '2px' },
        toggle: { width: '44px', height: '24px', borderRadius: '12px', position: 'relative', cursor: 'pointer', transition: '0.3s' }
    };

    const Toggle = ({ active, onToggle, disabled }: { active: boolean, onToggle: (v: boolean) => void, disabled?: boolean }) => (
        <div 
            onClick={() => !disabled && onToggle(!active)}
            style={{ 
                ...s.toggle, 
                background: active ? '#6366f1' : '#cbd5e1',
                opacity: disabled ? 0.5 : 1,
                cursor: disabled ? 'not-allowed' : 'pointer'
            }}
        >
            <div style={{ 
                width: '18px', height: '18px', background: 'white', borderRadius: '50%', 
                position: 'absolute', top: '3px', 
                left: active ? '23px' : '3px',
                transition: '0.3s'
            }} />
        </div>
    );

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '40px 20px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#1e293b', marginBottom: '32px' }}>System Settings</h1>
            
            <div style={s.card}>
                <div style={s.row}>
                    <div>
                        <div style={s.label}>MQTT Functionality</div>
                        <div style={s.desc}>Enable bi-directional communication for Smart Components.</div>
                    </div>
                    <Toggle active={status?.mqtt_enabled} onToggle={handleToggleMqtt} disabled={saving} />
                </div>

                <div style={s.row}>
                    <div>
                        <div style={s.label}>Screensaver</div>
                        <div style={s.desc}>Automatically dim display after inactivity.</div>
                    </div>
                    <Toggle active={status?.ss_enabled} onToggle={handleToggleScreensaver} disabled={saving} />
                </div>

                <div style={{ ...s.row, borderBottom: 'none' }}>
                    <div>
                        <div style={s.label}>Access Point Always On</div>
                        <div style={s.desc}>Keep setup WiFi active even after connecting to a network.</div>
                    </div>
                    <Toggle active={status?.ap_always_on} onToggle={handleToggleAP} disabled={saving} />
                </div>
            </div>

            <div style={{ marginTop: '32px', padding: '16px', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '12px', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                <div style={{ fontSize: '12px', color: '#6366f1', fontWeight: 800 }}>PRO TIP</div>
                <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>
                    Disabling MQTT can save memory and power if you are not using smart widgets.
                </div>
            </div>
        </div>
    );
};

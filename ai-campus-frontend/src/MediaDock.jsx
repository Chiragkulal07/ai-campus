import './campus.css';

const MicIcon = ({ off }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
    <path d="M12 18v4" />
    {off && <path d="m3 3 18 18" />}
  </svg>
);

const CamIcon = ({ off }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m16 13 5 3V8l-5 3" />
    <rect x="2" y="6" width="14" height="12" rx="2" />
    {off && <path d="m2 2 20 20" />}
  </svg>
);

// Compact mic/camera dock that sits just under the player's feet.
// Live states are shown with a level meter (mic) and a recording dot (camera).
function MediaDock({ x, y, isMicOn, isVideoOn, toggleMic, toggleVideo }) {
  return (
    <div
      className="md-dock"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className={`md-btn ${isMicOn ? 'is-live md-mic-live' : ''}`}
        onClick={toggleMic}
        aria-pressed={isMicOn}
        aria-label={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
      >
        <MicIcon off={!isMicOn} />
        {isMicOn && (
          <span className="md-meter" aria-hidden="true"><i /><i /><i /></span>
        )}
        <span className="md-label">{isMicOn ? 'Mute' : 'Mic'}</span>
      </button>

      <span className="md-sep" aria-hidden="true" />

      <button
        type="button"
        className={`md-btn ${isVideoOn ? 'is-live md-cam-live' : ''}`}
        onClick={toggleVideo}
        aria-pressed={isVideoOn}
        aria-label={isVideoOn ? 'Turn camera off' : 'Turn camera on'}
      >
        <CamIcon off={!isVideoOn} />
        {isVideoOn && <span className="md-rec" aria-hidden="true" />}
        <span className="md-label">{isVideoOn ? 'Stop' : 'Cam'}</span>
      </button>
    </div>
  );
}

export default MediaDock;

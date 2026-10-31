import { IconArrowLeft } from './icons';

// Consistent "back" control used at the top of every sub-screen.
function BackButton({ onClick, label = 'Back', className = '', style }) {
  return (
    <button
      type="button"
      className={`btn btn-ghost btn-sm back-btn ${className}`}
      onClick={onClick}
      style={style}
      aria-label={label}
    >
      <IconArrowLeft size={14} />
      <span>{label}</span>
    </button>
  );
}

export default BackButton;

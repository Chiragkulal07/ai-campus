// Minimal stroke icon set (24x24 grid, Lucide-style geometry).
const base = (size) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
});

const make = (paths) => function Icon({ size = 16, ...rest }) {
  return <svg {...base(size)} {...rest}>{paths}</svg>;
};

export const IconHome = make(<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9v11h14V9" /><path d="M10 20v-6h4v6" /></>);
export const IconMap = make(<><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z" /><path d="M9 3v15" /><path d="M15 6v15" /></>);
export const IconGamepad = make(<><rect x="2" y="7" width="20" height="11" rx="4" /><path d="M7 11v3" /><path d="M5.5 12.5h3" /><circle cx="15.5" cy="11.5" r="0.6" fill="currentColor" /><circle cx="17.5" cy="13.5" r="0.6" fill="currentColor" /></>);
export const IconRoute = make(<><circle cx="6" cy="19" r="2.5" /><circle cx="18" cy="5" r="2.5" /><path d="M8.5 19H16a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h7.5" /></>);
export const IconChart = make(<><path d="M3 3v18h18" /><path d="M8 16v-5" /><path d="M13 16V8" /><path d="M18 16v-8" /></>);
export const IconMic = make(<><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M19 10v1a7 7 0 0 1-14 0v-1" /><path d="M12 18v4" /></>);
export const IconMicOff = make(<><path d="m2 2 20 20" /><path d="M9 9v2a3 3 0 0 0 5.1 2.1" /><path d="M15 9.3V5a3 3 0 0 0-5.7-1.3" /><path d="M19 10v1a7 7 0 0 1-1.1 3.7" /><path d="M5 10v1a7 7 0 0 0 11.5 5.4" /><path d="M12 18v4" /></>);
export const IconVideo = make(<><path d="m16 13 5 3V8l-5 3" /><rect x="2" y="6" width="14" height="12" rx="2" /></>);
export const IconLogout = make(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></>);
export const IconArrowLeft = make(<><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></>);
export const IconArrowRight = make(<><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>);
export const IconChevronDown = make(<path d="m6 9 6 6 6-6" />);
export const IconPlus = make(<><path d="M12 5v14" /><path d="M5 12h14" /></>);
export const IconX = make(<><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>);
export const IconRefresh = make(<><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" /><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" /><path d="M21 3v5h-5" /><path d="M3 21v-5h5" /></>);
export const IconUsers = make(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9" /><path d="M16 3.1a4 4 0 0 1 0 7.8" /></>);
export const IconClock = make(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
export const IconAlert = make(<><circle cx="12" cy="12" r="9" /><path d="M12 8v4" /><path d="M12 16h.01" /></>);
export const IconTarget = make(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>);
export const IconTrophy = make(<><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M17 5h3v2a3 3 0 0 1-3 3" /><path d="M7 5H4v2a3 3 0 0 0 3 3" /></>);
export const IconCrown = make(<path d="m2 7 5 4 5-7 5 7 5-4-2 12H4z" />);
export const IconGrad = make(<><path d="M22 10 12 5 2 10l10 5 10-5z" /><path d="M6 12v5c3 2.5 9 2.5 12 0v-5" /></>);

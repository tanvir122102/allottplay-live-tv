# Phase 9 — Smart TV / Android TV Remote Optimization

Adds TV-first navigation without changing the public API architecture.

## Included
- D-pad friendly focus states and larger controls on coarse-pointer TV layouts.
- Arrow Up/Down and CH+/CH− channel switching.
- Enter/OK play/pause behavior.
- Back/Escape closes channel drawer, exits fullscreen, then closes player.
- Channel List drawer accessible from player UI or `C` / ChannelList key.
- Channel drawer supports focused remote navigation and current-channel highlighting.
- Left/Right seek only when the media is actually seekable.
- Player channel position indicator.
- Touch/remote controls remain compatible with the existing 7-second auto-hide behavior.

## Notes
TV browser capabilities vary by manufacturer. The implementation uses standard keyboard events, focus management, Fullscreen API, Wake Lock API, and HTML media APIs; unsupported device-specific keys cannot be guaranteed by a web app.

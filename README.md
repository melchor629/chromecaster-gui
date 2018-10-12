# chromecast-gui
 > Cast your computer audio to a Chromecast (Audio)

Send audio to a Chromecast using MP3 (with various bitrates), FLAC or WAV.

Download [latest release](https://github.com/melchor629/chromecaster-gui/releases/latest).

## Dependencies and Requirements

### macOS (aka OS X)
  - 10.9 or higher

### Linux
  - Ubuntu 12.04 and later, or Fedora 21 or Debian 8
  - 64 bit OS
  - libportaudio0
  - libappindicator1 (_for tray icon, if supported_)
  - libnotify-bin (_for notifications_)
  - libflac8
  - .deb package install everything for you :)

### Windows
 - Windows 7 or later
 - 64 bit OS

## Filling an issue

Before filling an issue, please check if you have the latest version of the app.

When [filling an issue][1], it is a good idea to grab the logs that the app create. Try to incude the logs of the moment when the issue happened. You can find them in:

 - **Windows**: `logs` folder where the executable is found
 - **macOS**: `~/Library/Logs/Chromecaster`
 - **Linux**: `~/.local/share/chromecaster`

If it is possible, please tell the steps to reproduce the bug. If it is something that you think it happens to you only, it is not needed, but it could help.

Include too the version of your OS in case of Windows and macOS, and your distribution and version (if applicable) for Linux.

It is possible that the Windows logs would have been insufficient, in this case it will be requested to grab logs from a `PowerShell`. You can try to run the app by opening the `PowerShell`, then drag and dropping into the command line the executable and finally pressing enter. It will show more text than in the file. This logs in general are needed when there are sound issues.


  [1]: https://github.com/melchor629/chromecaster-gui/issues/new
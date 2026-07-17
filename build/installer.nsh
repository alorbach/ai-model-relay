; AI Model Relay installer palette.
; This file is loaded by electron-builder before the Modern UI pages are declared.

!define MUI_BGCOLOR "101827"
!define MUI_TEXTCOLOR "E5E7EB"
!define MUI_DIRECTORYPAGE_BGCOLOR "101827"
!define MUI_DIRECTORYPAGE_TEXTCOLOR "E5E7EB"
!define MUI_INSTFILESPAGE_COLORS "E5E7EB 101827"
!define MUI_FINISHPAGE_LINK_COLOR "5EEAD4"

!macro customHeader
  BGGradient 101827 0B1220 E5E7EB
!macroend

!ifndef BUILD_UNINSTALLER
!macro customInit
  Call DarkInstallerChrome
!macroend

Function DarkInstallerChrome
  ; The buttons and branding strip are outside the page-specific nsDialogs host.
  GetDlgItem $0 $HWNDPARENT 1
  SetCtlColors $0 "E5E7EB" "1E293B"
  GetDlgItem $0 $HWNDPARENT 2
  SetCtlColors $0 "E5E7EB" "1E293B"
  GetDlgItem $0 $HWNDPARENT 3
  SetCtlColors $0 "E5E7EB" "1E293B"
  GetDlgItem $0 $HWNDPARENT 1028
  SetCtlColors $0 /BRANDING "94A3B8" "101827"
FunctionEnd
!endif

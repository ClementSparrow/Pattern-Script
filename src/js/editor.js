editor_tabmanager = new CodeEditorTabManager(document.getElementById('code'))
tabs.addTab('code', editor_tabmanager)
tabs.setLightMode(storage_get('light_mode'))

parseURLtoLoadGame()

title_screen.makeTerminalScreen()
// TODO: This one should not play sound, but it does not matter because the sound has not been compiled yet.
title_screen.openMenu(null) // can't close the menu

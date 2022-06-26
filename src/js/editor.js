var metadata_tabmanager = new MetaDataTabManager(document.getElementById('editor_pane_meta'))
tabs.addTab('meta', metadata_tabmanager)

var sprites_tabmanager = new SpritesTabManager(document.getElementById('sprites_list'))
tabs.addTab('sprites', sprites_tabmanager)
function createNewSpriteClicked() { sprites_tabmanager.addNewBlankSpriteWidget() }

var editor_tabmanager = new CodeEditorTabManager(document.getElementById('code'))
tabs.addTab('code', editor_tabmanager)
tabs.setLightMode(storage_get('light_mode'))

parseURLtoLoadGame()

title_screen.makeTerminalScreen() // WIP TODO: with the new system we should always be able to get the metadata to display the title screen, so that's what we should do, and remove the code for the terminal screen.
// TODO: This one should not play sound, but it does not matter because the sound has not been compiled yet.
title_screen.openMenu(null) // can't close the menu


function ListTabManager(html_list, game_def_property, name, widget_type)
{
	this.html_list = html_list
	html_list.classList.add('managed_widget_list')
	this.game_def_property = game_def_property
	this.type_name = name
	this.widget_type = widget_type
}

ListTabManager.prototype = {

	addNewWidget: function(item_def)
	{
		const widget = document.createElement('li')
		if (item_def.name.length > 0)
		{
			widget.setAttribute('data-name', item_def.name)
			game_def[this.game_def_property].push(item_def)
		}

		const name_label = document.createElement('label')
		name_label.innerText = this.type_name+' name:'
		const name_field = document.createElement('input')
		name_field.setAttribute('type', 'text')
		name_field.value = item_def.name
		// WIP TODO: add callback when the name changes, because it can now become a name used in the objects
		// WIP TODO: add a button to copy the name
		name_label.appendChild(name_field)
		widget.appendChild(name_label)

		const subwidget_container = document.createElement('div')
		subwidget_container.classList.add('list_widget')
		const subwidget = new this.widget_type(subwidget_container, item_def)
		widget.appendChild(subwidget_container)

		const widget_buttons = document.createElement('div')
		const buttons_def = [
			[ 'Delete', 'removeWidget' ],
			[ 'Copy',   'copyWidget' ],
		]
		for (const [button_label, button_callback] of buttons_def)
		{
			const button = document.createElement('button')
			button.innerText = button_label+' '+this.type_name
			button.addEventListener('click', (e) => this[button_callback](widget, item_def.name) )
			widget_buttons.appendChild(button)
		}
		widget.appendChild(widget_buttons)

		this.html_list.appendChild(widget)

		subwidget.finalize(item_def)
	},

	// WIP TODO: the delete button should be grayed if the item is used, otherwise it can cause issues with live update
	removeWidget: function(widget, name)
	{
		this.html_list.removeChild(widget)
		if (name.length > 0)
			delete game_def[this.game_def_property][name]
	},

	setContent: function(content)
	{
		this.html_list.textContent = ''
		game_def[this.game_def_property] = {}
		content.forEach(item_def => this.addNewWidget(item_def))
	},

	getContent: function()
	{
		return Array.from(this.html_list.querySelectorAll('li[data-name] > .list_widget')).map(widget => widget.toDef())
	},

	checkDirty: function(saved)
	{
		const current = this.getContent()
		return (saved.length != current.length) || saved.some( ([s,i]) => ! this.widget_type.sameItems(s, current[i]) )
	},

	setLoading: function() { },
	removeFocus: function() { },
	setLightMode: function(mode) { },
}

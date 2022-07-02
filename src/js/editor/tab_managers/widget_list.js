
// function to create easily HTML elements, that I put there because it's convenient
function make_HTML(element_type, options)
{
	const result = document.createElement(element_type)
	const { attr: attributes = {}, classes = [], style = {}, data = {}, events = {}, text, value } = options
	for (const [name, value] of Object.entries(attributes))
	{
		result.setAttribute(name, value)
	}
	result.classList.add(...classes)
	for (const [name, value] of Object.entries(data))
	{
		result.dataset[name] = value
	}
	if (value != undefined) result.value = value
	if (text !== undefined) result.innerText = text
	for (const [name, value] of Object.entries(style))
	{
		result.style[name] = value
	}
	for (const [name, callback] of Object.entries(events))
	{
		result.addEventListener(name, callback, false)
	}
	return result
}

function ListTabManager(html_list, game_def_property, name, widget_type)
{
	this.name = game_def_property
	this.html_list = html_list
	html_list.classList.add('managed_widget_list')
	this.game_def_property = game_def_property
	this.type_name = name
	this.widget_type = widget_type
	// to allow autocompletion of fields that ask for a name in this list
	this.names_datalist = make_HTML('datalist', {attr: {id: name.toLowerCase()+'_names'}})
	document.head.appendChild(this.names_datalist)
}

ListTabManager.prototype = {

	addNewWidget: function(item_def)
	{
		const widget = document.createElement('li')

		const name_label = make_HTML('label', { text: this.type_name+' name:', })
		const name_field = make_HTML('input', {
			attr: {type: 'text'},
			value: item_def.name,
			events: {change: (e) => { widget.dataset.name = (e.target.value == '') ? null : e.target.value; this.updateNamesList() }}
		})
		// WIP TODO: add a button to copy the name
		name_label.appendChild(name_field)
		widget.appendChild(name_label)

		const subwidget_container = make_HTML('div', {classes: ['list_widget']})
		const subwidget = new this.widget_type(subwidget_container, item_def)
		subwidget.onChangeContent = () => this.widgetContentChanged(name_field, subwidget)
		subwidget.onChangeState = () => this.widgetStateChanged(name_field, subwidget)
		widget.appendChild(subwidget_container)

		const widget_buttons = document.createElement('div')
		const buttons_def = [
			[ 'Delete', 'removeWidget' ],
			[ 'Copy',   'copyWidget' ],
		]
		for (const [button_label, button_callback] of buttons_def)
		{
			widget_buttons.appendChild(make_HTML('button', {
				text: button_label+' '+this.type_name,
				events: { click: (e) => this[button_callback](widget, item_def.name) },
			}))
		}
		widget.appendChild(widget_buttons)

		this.html_list.appendChild(widget)

		subwidget.finalize(item_def)

		if (item_def.name.length > 0)
		{
			widget.dataset.name = item_def.name
			game_def[this.game_def_property][item_def.name] = subwidget.toDef()
		}
		this.updateNamesList()
	},

	updateNamesList: function()
	{
		// update the datalist for name fields autocompletion
		this.names_datalist.innerText = ''
		for (const li of this.html_list.querySelectorAll('li[data-name]'))
		{
			this.names_datalist.appendChild( make_HTML('option', {attr: {value: li.dataset.name}}) )
		}

		// WIP TODO: recompile, because a name can have changed that was or has become used in the objects
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
		for(const item_def of Object.values(content))
			this.addNewWidget(item_def)
	},

	getContent: function()
	{
		return Object.assign({}, game_def[this.game_def_property])
		// return Array.from(this.html_list.querySelectorAll('li[data-name]')).map(li => game_def[this.game_def_property][li.dataset.name])
	},

	checkDirty: function(saved)
	{
		const current = this.getContent()
		if (Object.keys(saved).length != Object.keys(current).length)
			return true
		return Object.keys(saved).some( (k) => ! this.widget_type.prototype.sameItems(saved[k], current[k]) )
	},

	setLoading: function() { },
	removeFocus: function() { },
	setLightMode: function(mode) { },
}

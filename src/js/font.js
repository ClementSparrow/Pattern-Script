const font_width = 5
const font_height = 12

const chars_in_font = '0123456789abcdefghijklmnopqrstuvwx×yzABCDEFGHIJKLMNOPQRSTUVWXYZ.·•…†‡ƒ‚„,;:?¿!¡@£$%‰^&*()+÷±-–—_= {}[]\'‘’“”"/\\|¦<‹«>›»~˜`#' +
 'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßẞàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿĀāĂăĄąĆćĈĉĊċČčĎďĐđĒēĔĕĖėĘęĚěĜĝĞğĠġĢģĤĥĦħĨĩĪīĬĭĮįİıĲĳĴĵĶķĸĹĺĻļĽľĿŀŁłŃńŅņŇňŉŊŋŌōŎŏŐőŒœŔŕŖŗŘř' + 
 'ŚśŜŝŞşŠšŢţŤťŦŧŨũŪūŬŭŮůŰűŲųŴŵŶŷŸŹźŻżŽž€™¢¤¥§¨©®ªº¬¯°'

var font = new Image()
// <-- FONT START -->
// <-- Do not edit these comments, they are used by buildStandalone.js to replace the loading of the font image with an inline version of the image. -->
// <-- Note that ideally, we should keep track of all colors/chars used in the game and integrate only these in the inlined font picture. -->
font.src = 'fonts/font-5x12.png'

font.asDataURL = function()
{
	var canvas = document.createElement('canvas')
	canvas.width = this.width
	canvas.height = this.height
	canvas.getContext('2d').drawImage(this, 0, 0)
	return canvas.toDataURL("image/png")
}
// <-- FONT END -->
font.addEventListener('load', function()
{
	var canvas = document.createElement('canvas')
	canvas.width = font.width
	canvas.height = font.height
	var fctx = canvas.getContext('2d')
	fctx.drawImage(font, 0, 0)
	font.pixels = fctx.getImageData(0, 0, canvas.width, canvas.height).data

	redraw()
})

font.colored_fonts = { '1-#FFFFFFFF': font }

font.colored_font = function(css_color)
{
	const key = css_color
	if (key in this.colored_fonts)
		return this.colored_fonts[key]

	if (font.pixels === undefined) // image is not loaded yet
		return null

	const color = Array.from( [1,3,5], i => parseInt(css_color.substr(i,2), 16) )
	const f_alpha = parseInt(css_color.substr(7,2), 16) || 255

	var canvas = document.createElement('canvas')
	canvas.width = this.width
	canvas.height = this.height
	var fctx = canvas.getContext('2d')

	for (var i = 0; i < this.pixels.length; i += 4)
	{
		const alpha = this.pixels[i+3]/255 // alpha channel. 0=transparent, 255=opaque
		if (alpha === 0)
			continue
		fctx.fillStyle = 'rgba(' + color.map(x => Math.round(x*alpha)).join() + ',' + f_alpha + ')'
		fctx.fillRect( ((i/4) % this.width), Math.floor((i/4) / this.width), 1, 1)
	}
	this.colored_fonts[key] = canvas
	return canvas
}

function draw_char(ctx, colored_font_image, ch, x, y, w, h) // draws char ch at position (x,y) in the canvas ctx with width w and height h
{
	const ch_index = chars_in_font.indexOf(ch)
	if (ch_index < 0)
		return
	ctx.drawImage(colored_font_image, ch_index*w, 0, w, h, x, y, w, h)
}

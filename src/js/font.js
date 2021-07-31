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

font.colored_fonts = { '#ffffffff': font }

font.colored_font = function(css_color)
{
	if (css_color in this.colored_fonts)
		return this.colored_fonts[css_color]

	if (this.width === 0) // image is not loaded yet
	{
		font.addEventListener('load', () => redraw() )
		return null;
	}

	var color = [ parseInt(css_color.substr(1,2),16), parseInt(css_color.substr(3,2),16), parseInt(css_color.substr(5,2),16), parseInt(css_color.substr(7,2),16) ]
	if (isNaN(color[3]))
		color[3] = 255

	var canvas = document.createElement('canvas');
	canvas.width = this.width;
	canvas.height = this.height;
	var fctx = canvas.getContext('2d');

	fctx.drawImage(this, 0, 0);

	const imageData = fctx.getImageData(0, 0, canvas.width, canvas.height);
	const data = imageData.data;
	for (var i = 0; i < data.length; i += 4)
	{
		const alpha = data[i+3]/255 // alpha channel. 0=transparent, 255=opaque
		data[i]   = color[0]*alpha; // red
		data[i+1] = color[1]*alpha; // green
		data[i+2] = color[2]*alpha; // blue
		data[i+3] *= (color[3]/255)
	}
	fctx.putImageData(imageData, 0, 0)
	this.colored_fonts[css_color] = canvas
	return canvas;
}

function draw_char(ctx, colored_font_image, ch, x, y, w, h) // draws char ch at position (x,y) in the canvas ctx with width w and height h
{
	const ch_index = chars_in_font.indexOf(ch)
	if (ch_index < 0)
		return;
	ctx.imageSmoothingEnabled = false
	ctx.drawImage(colored_font_image, ch_index*font_width, 0, font_width, font_height, x, y, w, h)
}

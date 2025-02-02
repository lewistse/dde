/**
 * Created by Fry on 4/17/16.
 */
var ipcRenderer = require('electron').ipcRenderer
var request = require('request')

ipcRenderer.on('record_dde_window_size', function(event){
    //onsole.log("top of on record_window_size")
    persistent_set("dde_window_x",      window.screenX)
    persistent_set("dde_window_y",      window.screenY)
    persistent_set("dde_window_width",  window.outerWidth)
    persistent_set("dde_window_height", window.outerHeight)
});

window.set_dde_window_size_to_persistent_values = function(){
    console.log("top of set_dde_window_size_to_persistent_values " +
                  persistent_get("dde_window_width") + " " +
                  persistent_get("dde_window_height"))
    ipcRenderer.send('set_dde_window_size',
                        persistent_get("dde_window_x"),
                        persistent_get("dde_window_y"),
                        persistent_get("dde_window_width"),
                        persistent_get("dde_window_height"))
}

//_________show_window and helper fns__________
//get the value of the path in the UI.
window.get_in_ui = function(path_string){
    //return value_of_path(path_string) //fails on getting svg attributes,
    //and returns strings for numbers.
    let path_elts = path_string.split(".")
    let the_loc = window
    for (var i = 0; i < path_elts.length; i++){
        var path_elt = path_elts[i]
        if (i == (path_elts.length - 1)){ //on last elt so set it
            if( // the_loc.hasOwnProperty("attributes") /doesn't work
                the_loc.hasAttributes() &&
                the_loc.attributes.hasOwnProperty(path_elt)) {
                let result = the_loc.getAttribute(path_elt)
                if (is_string_a_number(result)) {
                    return parseFloat(result)
                }
                else { return result }

            } //necessary for "active" attributes like cx in svg ellipse, in order to actually get the real value of  "cx" property
            else {
                let result = the_loc.getAttribute(path_elt)
                if (is_string_a_number(result)) {
                    return parseFloat(result)
                }
                else { return result }
             }
        }
        else {
            the_loc = the_loc[path_elt]
        }
    }
}


window.set_in_ui = function(path_string, value){
    let path_elts = path_string.split(".")
    let the_loc = window
    for (var i = 0; i < path_elts.length; i++){
        var path_elt = path_elts[i]
        if (i == (path_elts.length - 1)){ //on last elt so set it
            if( // the_loc.hasOwnProperty("attributes") /doesn't work
               the_loc.hasAttributes() &&
               the_loc.attributes.hasOwnProperty(path_elt)) {
                    the_loc.setAttribute(path_elt, value)
            } //necessary for "active" attributes like cx in svg ellipse, in order to actually change the visible appearance of the ellipse
            else { the_loc[path_elt] = value }
        }
        else {
            the_loc = the_loc[path_elt]
        }
    }
}



window.remove_in_ui = function(path_string){
        let elt = value_of_path(path_string)
        elt.remove()
}

window.replace_in_ui = function(path_string, new_html){
    let elt = value_of_path(path_string)
    $(elt).replaceWith(new_html)
}

function html_to_tag_name(html){
    if (html.length < 2) { return null }
    var start_pos = 0
    if (html[0] == "<") start_pos = 1
    var end_pos = html.indexOf(" ")
    if (end_pos == -1) end_pos = html.length
    let result = html.substring(start_pos, end_pos)
    if      (result.endsWith("/>")) result = result.substring(0, result.length - 2)
    else if (result.endsWith(">"))  result = result.substring(0, result.length - 1)
    return  result.trim()
}

window.html_to_tag_name = html_to_tag_name

//returns an array of arrays.
// the Inner array has 2 elts, a string of the attribute name
//and a string of the attributer value
function html_attributes_and_values(html){
    html = html.trim()
    if (html.length < 3) { return null }
    let start_pos = 0
    if (html[0] == "<") {
        start_pos = html.indexOf(" ")
        if (start_pos == -1) return []
    }
    let end_pos = html.length
    if (last(html) == ">") end_pos = end_pos - 1
    if (html[end_pos - 1] == "/") end_pos = end_pos - 1
    let attr_string = html.substring(start_pos, end_pos)
    attr_string.trim()
    let result = []
    /*//let pairs = attr_string.split(" ")
    for(let pair of pairs){
        pair = pair.trim()
        if (pair.length > 2){
            let name_val = pair.trim().split("=")
            let name = name_val[0].trim()
            let val  = name_val[1].trim()
            //cut off quotes from val if any
            let val_start = 0
            if (["'", '"', "`"].includes(val[0])) val_start = 1
            let val_end = val.length
            if (["'", '"', "`"].includes(last(val))) val_end = val_end - 1
            val = val.substring(val_start, val_end)
            result.push([name, val])
        }
    }*/
    var state = "before_name"
    var name = ""
    var start_token = 0
    var string_delim = null
    for(let i = 0; i < attr_string.length; i++){
      let char = attr_string[i]
      if (state == "before_name"){
          if (char == " ") {}
          else if (char == "/") break;
          else if (char == ">") break;
          else { start_token = i; state = "in_name"}
      }
      else if (state == "in_name") {
          if (char == "=") {
             name = attr_string.substring(start_token, i)
             state = "in_val"
             start_token = i + 1
          }
      }
      else if (state == "in_val"){
          if ((start_token == i) && ["'", '"', "`"].includes(char)){
              state = "in_string"
              start_token += 1
              string_delim = char
          }
          else if (char == " ") {
              val = attr_string.substring(start_token, i)
              result.push([name, val])
              state = "before_name"
          }
      }
      else if (state == "in_string"){ //pretend no backslashed string delimiters.
          if (char == string_delim) {
              val = attr_string.substring(start_token, i)
              if (val.length > 0) {
                result.push([name, val])
              }
              //else we only had "" for the val so just ignore it.
              state = "before_name"
          }
      }
      else { shouldnt("in html_attributes_and_values with illegal state of: " + state) }
    }
    return result
}

window.html_attributes_and_values = html_attributes_and_values

//input" '<foo a="3"> bar </foo>'  output: " bar "
function html_content(html){
    html = html.trim()
    let close_angle_pos = html.indexOf(">")
    if(close_angle_pos == html.length - 1) { return "" }
    else {
        let open_angle_pos = html.indexOf("<", 1)
        if(open_angle_pos == -1) { return "" } //actually this means the html is invalid syntax
        else { return html.substring(close_angle_pos + 1, open_angle_pos) }
    }
}
window.html_content = html_content

//inserts the new_html as the new last child of the element indicated by path_string
window.append_in_ui = function(path_string, new_html){
        let elt = value_of_path(path_string)
        let ancestor_svg = $(elt).closest("svg")
        if (ancestor_svg.length > 0) {
            ancestor_svg = ancestor_svg[0]
            let new_tag     = html_to_tag_name(new_html)
           let attr_vals   = html_attributes_and_values(new_html)
           let new_svg_elt = document.createElementNS("http://www.w3.org/2000/svg", new_tag);
           for (let pair of attr_vals){
            new_svg_elt.setAttribute(pair[0], pair[1])
           }
           let content = html_content(new_html)
            new_svg_elt.innerHTML = content
           ancestor_svg.appendChild(new_svg_elt);
        }
        else{ $(elt).append(new_html) }
}

window.window_index = 0

window.latest_window_index = function () {
    if(window_index === 0) { return null } //no windows have been created
    else { return window_index - 1 }
}

var show_window_titles_to_window_index_map = {} //used by close_window, stores an array of all window_indexes for that title

function set_window_index(jqxw_jq, title){
    let the_window_index = window_index
    jqxw_jq.attr('data-window_index', the_window_index)
    //console.log ("setting window to index: " + the_window_index)
    let index_arr = show_window_titles_to_window_index_map[title]
    if (!index_arr) {
       index_arr = [the_window_index]
        show_window_titles_to_window_index_map[title] = index_arr
    }
    else { index_arr.push(the_window_index) }
    window_index += 1
    return the_window_index
}


window.set_window_index = set_window_index

function is_window_shown(index){
    let win = $('[data-window_index=' + index + ']')
    return win.length != 0
}
window.is_window_shown = is_window_shown

//index can be an int or a string
function get_window_of_index(index){
    if (index == undefined){ //risky to just get the latest created, but a good trick when I need to call some init  for a window as in combo box for app builder from ab.fill_in_action_names
        index = window_index - 1
    }
    //onsole.log ("getting window of index: " + index + " with next window_index: " + window_index)
    let win = $('[data-window_index=' + index + ']')
    //onsole.log("get_window_of_index got win: " + win)
    return win
}
window.get_window_of_index = get_window_of_index

function get_index_of_window(jqxw_jq){
    return jqxw_jq.attr('data-window_index')
}
window.get_index_of_window = get_index_of_window

function get_jqxw_jq_of_window_containing_elt(elt){ //elt is usually a button that's inside the window
    if (elt.tagName == "LI"){
        var window_index = $(elt).attr("data-window_index")
        return get_window_of_index(window_index)
    }
    else {
        var window_elt = elt.closest(".show_window")
        return $(window_elt)
    }
}
window.get_jqxw_jq_of_window_containing_elt = get_jqxw_jq_of_window_containing_elt

function get_window_content_of_elt(elt){
    if (elt.tagName == "LI"){
        var window_index = $(elt).attr("data-window_index")
        var jqxw_jq = get_window_of_index(window_index)
        return jqxw_jq.find(".show_window_content")
    }
    else {
        return $(elt).closest(".show_window_content")
    }
}
window.get_jqxw_jq_of_window_containing_elt

function get_window_index_containing_elt(elt){
    var jqxw_jq = get_jqxw_jq_of_window_containing_elt(elt)
    return get_index_of_window(jqxw_jq)
}
window.get_window_index_containing_elt

//esp good for a zillion human_notify show windows
function close_all_show_windows(){
    var wins = $('[data-window_index]')
    if (wins.length > 0){ //note: if we try to close when there are no wins, we get an error.
        wins.closest(".show_window").jqxWindow("close")
    }
}
window.close_all_show_windows = close_all_show_windows

function show_window_values(vals){
    inspect(vals)
}
window.show_window_values = show_window_values

window.show_window = function({content = `<input type="submit" value="Done"/>`,
                        title = "DDE Information", width = 400, height = 400, x = 200, y = 200,
                        resizable = true,
                        draggable = true,
                        background_color = "rgb(238, 238, 238)",
                        is_modal = false,
                        show_close_button = true,
                        show_collapse_button = true,
                        trim_strings = true,
                        window_class,
                        callback = show_window_values,
                        close_same_titled_windows = true,
                        init_elt_id = null} = {}){
      //callback should be a string of the fn name or anonymous source.
       if (close_same_titled_windows){
           let latest_win = latest_window_of_title(title)
           if(latest_win && latest_win.offset()){
               x = latest_win.offset().left //user might have repositioned the old window. let's preserve that
               y = latest_win.offset().top
               width = latest_win.width()   //user might have resized the old window. let's preserve that
               height = latest_win.height()
               close_window(title)
           }
       }
       if ((arguments.length > 0) && (typeof(arguments[0]) == "string")){
         var content = arguments[0] //all the rest of the args will be bound to their defaults by the js calling method.
       }
       if (typeof(content) !== "string"){
                content = stringify_value(content)
       }
       if (typeof(callback) == "function"){
           let fn_name = callback.name
           if (fn_name && (fn_name != "")) {
                if(fn_name == "callback") { //careful, might be just JS being clever and not the ctual name in the fn def
                    fn_name = function_name(callback.toString()) //extracts real name if any
                    if (fn_name == "") { //nope, no actual name in fn
                        callback = callback.toString() //get the src of the anonymous fn
                    }
                    else { callback = fn_name }
                }
                else { callback = fn_name }
            }
           else { callback = callback.toString() } //using the src of an annonymous fn.
       }
       //var the_instruction_id = null
       //if(arguments[0]) {the_instruction_id =  arguments[0].the_instruction_id}
        content = "<div class='show_window_content' contentEditable='false' style='font-size:15px;'>\n" +
            "<input name='window_callback_string' type='hidden' value='" + callback + "'/>\n" +
            "<input name='trim_strings' type='hidden' value='" + trim_strings + "'/>\n" +
            //the next 2 are only for Human.show_window
            (((arguments.length > 0) && (arguments[0].the_job_name)) ?
            "<input name='the_job_name' type='hidden' value='" + arguments[0].the_job_name + "'/>\n": "") +
            //((the_instruction_id || (the_instruction_id == 0)) ?
            //"<input name='the_instruction_id' type='hidden' value='" + the_instruction_id + "'/>\n": "") +
            content + "</div>" //to allow selection and copying of window content
        //kludge but that's dom reality
        var holder_div = document.createElement("div"); // a throw away elt
        holder_div.innerHTML ='<div class="show_window" style="display:none;">' +
            '<div class="window_frame" style="font-size:20px;">' + title + '</div>' + //coral #ff8c96
            '<div style="overflow:auto; background-color:' + background_color + ';">' + content + '</div>' +
            '</div>'
        var window_elt = holder_div.firstElementChild
        //body_id.appendChild(window_elt) //this is automatically done when I call jqxw_jq.jqxWindow({width:width below
        var jqxw_jq = $(window_elt).jqxWindow({width: width,
                                                height: height,
                                                position: {x: x, y: y},
                                                //autoOpen: true, //open window upon creation, always
                                                isModal: is_modal, //default false
                                                showCloseButton: show_close_button, //default true but may want to turn off
                                                // IFF you want to always close the window with your own submit button and do some action whenever window closes.
                                                //otherwise, user could click the close button and it wouldn't run user code assocaited with their own submit button.
                                                showCollapseButton: show_collapse_button, //default true
                                                showAnimationDuration: 500,
                                                closeAnimationDuration: 500, //doesn't work. its always 0
                                                collapseAnimationDuration:500,
                                                maxHeight: 2000,
                                                maxWidth: 2000,
                                                resizable: resizable,
                                                draggable: draggable
                                                }) //default maxWidth = 800, default maxHeight=600
        if (window_class){jqxw_jq.addClass(window_class)} //used by app_builder
        let the_window_index = set_window_index(jqxw_jq, title)
        jqxw_jq.on('close', function (event) { jqxw_jq.remove() }); //handles both the removal from a submit button AND the removal from usre hitting the upper right close box.
        //jqxw_jq.find(".jqx-window-content").css("background-color", "#eeeeee")
        jqxw_jq.css("border", "5px solid #666666") //dark gray border so that shows up against black of simulation pane
        //jqxw_jq.children().css("background-color", "#dddddd")
        //jqxw_jq.jqxWindow({width:width, height:height, position:{x: x, y: y}, showCloseButton: true})
        //jqxw_jq.jqxWindow('setTitle', title);
        //jqxw_jq.jqxWindow('setContent', content);
        //jqxw_jq.on('created', function (event) { out("made window") });
        jqxw_jq.jqxWindow('show'); //this is performed with creation option: autoOpen:true
        jqxw_jq.jqxWindow('focus');
        setTimeout(install_onclick_via_data_fns, 10) //todo probably shouldn't have both of these!
        setTimeout(function(){install_submit_window_fns(jqxw_jq)}, 10)
        if (init_elt_id){
            setTimeout(function(){window[init_elt_id].click()} , 100)
        }
        return the_window_index //used by dex.train
}

function install_onclick_via_data_fns(){
    var elts = document.getElementsByClassName("onclick_via_data")
    for (var index = 0; index  < elts.length; index++){ //bug in js chrome: for (var elt in elts) doesn't work here.
        var elt = elts[index]
        elt.onclick = onclick_via_data_fn
    }
}
window.install_onclick_via_data_fns = install_onclick_via_data_fns

function install_submit_window_fns(jqxw_jq){
    var info_win_div = jqxw_jq.find(".show_window_content")
    var ins = info_win_div.find(".clickable")
    for (var index = 0; index < ins.length; index++){ //bug in js chrome: for (var elt in elts) doesn't work here.
        var inp = ins[index]
        inp.onclick = submit_window
    }
    var ins = info_win_div.find("input")
    for (var index = 0; index < ins.length; index++){ //bug in js chrome: for (var elt in elts) doesn't work here.
        var inp = ins[index]
        if ((inp.type == "submit") || (inp.type == "button")){
            inp.onclick = submit_window
        }
        else{
            if (inp.dataset.onchange == "true") { inp.onchange = submit_window }
            if (inp.dataset.oninput  == "true") { inp.oninput  = submit_window }
        }
    }
    var ins = info_win_div.find("select")
    for (var index = 0; index < ins.length; index++){ //bug in js chrome: for (var elt in elts) doesn't work here.
        var inp = ins[index]
        if (inp.dataset.onchange == "true") { inp.onchange = submit_window }
        if (inp.dataset.oninput  == "true") { inp.oninput  = submit_window }
    }
    var ins = info_win_div.find("a")
    for (var index = 0; index  < ins.length; index++){ //bug in js chrome: for (var elt in elts) doesn't work here.
        var inp = ins[index]
        inp.onclick = submit_window
    }
    var combo_boxes = jqxw_jq.find(".combo_box")  //should be a div tag a la <div class="combo_box><option>one</option><option>two</option></div>
    for (var i = 0; i < combo_boxes.length; i++){
        var cb = $(combo_boxes[i])
        var kids = cb.children()
        var choices = []
        var sel_index = 0
        for (var j=0; j < kids.length; j++){
            var kid = kids[j] //could be nearly any html elt but option is a good choice.
            choices.push(kid.innerHTML)
            if (kid.selected) {sel_index = j}
        }
        if (cb[0].style && cb[0].style.width) {
            var cb_width = cb[0].style.width
            cb.jqxComboBox({height: '16px', source: choices, selectedIndex: sel_index, width: cb_width})
        }
        else{
            cb.jqxComboBox({height: '16px', source: choices, selectedIndex: sel_index})
        }
    }
    //don't do this. Just give the canvas tag (or any tag  you want to be clickable,  prop:
    // class="clickable"
    //let canvases = info_win_div.find("canvas")
    //for(let canvas_elt of canvases) {
    //  canvas_elt.onclick = submit_window
    //}
    var window_index = get_index_of_window(jqxw_jq)
    var menus = jqxw_jq.find(".menu")
    for (var i = 0; i < menus.length; i++){
        var menu = $(menus[i])
        var outer_lis = menu[0].children[0].children
        if (outer_lis && outer_lis[0] && outer_lis[0].children && outer_lis[0].children[0]){
            var inner_lis = outer_lis[0].children[0].children
            install_menus_and_recurse(inner_lis, window_index)
        }
        // else we've got a menu with zero items, but for dev purposes its nice to
        //be able to show the menu's name, and its down arrow, even if nothing under it.
        $(menu).jqxMenu({ width: '100px', height: '25px' })
    }
}

window.install_submit_window_fns = install_submit_window_fns

function install_menus_and_recurse(inner_lis, window_index){ //the arg is li elts that *might* not be leaves
    for(var j = 0; j < inner_lis.length; j++){
        var inner_li = inner_lis[j]
        inner_li.onclick = submit_window
        $(inner_li).attr('data-window_index', window_index)//because jqx sticks these LIs outside the dom so it screws uo the normal way of looking up the dom to find it.
        if (inner_li.children.length > 0){
            install_menus_and_recurse(inner_li.children[0].children, window_index)
        }
    }
}
window.install_menus_and_recurse = install_menus_and_recurse


window.submit_window = function(event){
     // descriptions of x & y's: http://stackoverflow.com/questions/6073505/what-is-the-difference-between-screenx-y-clientx-y-and-pagex-y
    event.stopPropagation();
    let result = {offsetX:event.offsetX,  offsetY:event.offsetY, //relative to the elt clocked on
                  x:event.x,              y:event.y, //relative to the parent of the elt clicked on
                  clientX:event.clientX,  clientY:event.clientY, //Relative to the upper left edge of the content area (the viewport) of the browser window. This point does not move even if the user moves a scrollbar from within the browser.
                  pageX:event.pageX,      pageY:event.pageY, //Relative to the top left of the fully rendered content area in the browser.
                  screenX:event.screenX,  screenY:event.screenY, //Relative to the top left of the physical screen/monitor
                  altKey:event.altKey,    //on mac, the option key.
                  ctrlKey:event.ctrlKey,
                  metaKey:event.metaKey, //on WindowsOS, the windows key, on Mac, the Command key.
                  shiftKey:event.shiftKey,
                  tagName:this.tagName}
    result.window_index = get_window_index_containing_elt(this)//get_index_of_window(jsxw_jq)
    //var jsxw_jq                 = get_jqxw_jq_of_window_containing_elt(this)
    if (this.tagName == "LI"){ //user clicked on a menu item
        if ($(this).attr("data-name")) {result.clicked_button_value = $(this).attr("data-name")}
        else {result.clicked_button_value = this.innerHTML}
    }
    else if (this.tagName == "A"){
        if (this.href.endsWith("#")){
            result.clicked_button_value = this.innerHTML
        }
        else { //we've got a real url. The only thing to do with it is open a window, so
            //don't even go through the handler fn, just do it.
            var url = this.href
            var double_slash_pos = url.indexOf("//")
            url = url.substring(double_slash_pos + 2, url.length)
            var single_slash_pos =  url.indexOf("/")
            url = url.substring(single_slash_pos + 1, url.length)
            if (!url.startsWith("http")){
                url = "http://" + url
            }
            window.open(url)
            return
        }
    }
    /*else if (this.tagName == "INPUT") {
        if ((this.type == "button") || (this.type == "submit")) { //used by the callback to chose the appropriate action
            if(this.name)     { result.clicked_button_value = this.name   }
            elsce if (this.id) { result.clicked_button_value = this.id     }
            else              { result.clicked_button_value = this.value  } //this is the disolayed text in the button.
                //but note that we *might* have 2 buttons with the same label but want them to have different actions
                //so check name and id first because we can give them different values even if
                //the label (value) is the same for 2 different buttons.
                //but if we WANT the action to be the same for 2 same-valued buttons, fine
                //give the buttons values but no name or id.
        }
        else { //for sliders, etc. if they have data-onchange='true' or data-onclick='true'
            // if (this.oninput) { this.focus() } //because at least for input type="text", when
                                               //the oninput fires, it unfocues the input elt.
            result.clicked_button_value = this.name
        }
    }*/
    else if (this.tagName == "INPUT") {
        if(this.name)     { result.clicked_button_value = this.name   }
        else if (this.id) { result.clicked_button_value = this.id     }
        else              { result.clicked_button_value = this.value  } //this is the disolayed text in the button.
        //but note that we *might* have 2 buttons with the same label but want them to have different actions
        //so check name and id first because we can give them different values even if
        //the label (value) is the same for 2 different buttons.
        //but if we WANT the action to be the same for 2 same-valued buttons, fine
        //give the buttons values but no name or id.
    }
    else if (this.name) { result.clicked_button_value = this.name }
    else if (this.id)   { result.clicked_button_value = this.id }

    var window_content_elt = get_window_content_of_elt(this)
    var trim_strings_elt = window_content_elt.find("input[name|='trim_strings']")
    var trim_strings = trim_strings_elt[0].value
    if (trim_strings == "false") { trim_strings = false}
    else {trim_strings = true}
    var inputs = $(window_content_elt).find("input") //finds all the descendents of the outer div that are "input" tags
    var window_callback_string = null
    for (var i = 0; i < inputs.length; i++){
        var inp = inputs[i]
        var in_name = inp.name
        if      (!in_name) { in_name = inp.id }
        else if (!in_name) { in_name = inp.value }
        var in_type      = inp.type    //text (one-liner), submit, button, radio, checkbox, etc.
        if (in_type == "radio"){
            if (inp.checked){
                result[in_name] = inp.value
            }
            else if (result[in_name] === undefined){ //first time we've seen a radio button from this grou.
                //make sure is val is null instead of not setting
                //it at call because if no button was set on init,
                //and user didn't click on one, we STILL
                //want a field for it in the result (unlike most
                //stupid web programming that would pretend it didn't exist.
                //we want to see this field when debugging, etc.
                result[in_name] = null
            }
        }
        else if (in_type == "checkbox"){
            if (in_name){
                var val = inp.checked
                result[in_name] = val
            }
        }
        else if (in_type == "file") { result[in_name] = ((inp.files.length > 0) ?
                                                          inp.files[0].path :
                                                          null) }
        else if (in_type == "submit"){}
        else if (in_type == "button"){} //button click still causes the callback to be called, but leaves window open
        else if (in_type == "hidden") { //trim_strings, window_callback_string, and for Human.show_instruction: the_job_name
            var val = inp.value
            if      (val == "false") {val = false}
            else if (val == "true")  {val = true}
            else if (val == "null")  {val = null}
            else if (is_string_a_number(val)) { val = parseFloat(val) } //for "123", this will return an int
            result[in_name] = val
        }
        else if (in_type == "text"){
            if (in_name){
                var val = inp.value
                if (trim_strings) { val = val.trim() }
                result[in_name] = val
            }
        }
        else if ((in_type == "number") || (in_type == "range")){
            if (in_name){
                var val = parseFloat(inp.value.trim()) //comes in as a string. Gee why would an input of type number return a number? It would be too logical
                if (isNaN(val)) { val = null }
                result[in_name] = val
            }
        }
        else { //all the other inputs.
            if (in_name){
                var val = inp.value
                result[in_name] = val
            }
        }
    }
    var textareas = $(window_content_elt).find("textarea") //finds all the descentents of teh outer div that are "input" tags
    for (var i = 0; i < textareas.length; i++){
        var inp = textareas[i]
        var in_name = inp.name
        if (in_name){
            var val = inp.value
            if (trim_strings) { val = val.trim() }
            result[in_name] = val
            result[in_name + "_width"]  = inp.style.width //usesd by app builder to get size of input and text areas being made by the user
            result[in_name + "_height"] = inp.style.height
        }
    }
    var selects = $(window_content_elt).find("select") //finds all the descentents of teh outer div that are "input" tags
    for (var i = 0; i < selects.length; i++){
        var inp = selects[i]
        var in_name = (inp.name ? inp.name : inp.id)
        if (in_name){
            var val = inp.value
            result[in_name] = val
        }
    }
    var combo_boxes = $(window_content_elt).find(".combo_box")  //should be a div tag a la <div class="combo_box><option>one</option><option selected="selected">two</option></div>
    for (var i = 0; i < combo_boxes.length; i++){
        let outer_cb = combo_boxes[i]
        let inner_cb = outer_cb.children[1]
        let val = $(outer_cb).val() //inner_cb.value
        result[inner_cb.name] = val
    }
    if (this.type == "submit"){
        //$('#jqxwindow').jqxWindow('close');
        close_window(this)
    }

    //widget_values: result,
    let callback_fn_string = result["window_callback_string"]
    let cb = value_of_path(callback_fn_string)
    if (!cb) { try { cb = window.eval("(" + callback_fn_string + ")") } //probably have an anonymous fn. Evaling it without the parent wrappers errors.
               catch(err){ dde_error("During show_window handler, could not find: " + callback_fn_string) } //just ignore
    }
     //cb is probably "function () ..." ie a string of a fn src code
    if (!cb) { //cb could have been a named fn such that wehn evaled didn't return the fn due to bad js design
       if(callback_fn_string.startsWith("function ")){
           let fn_name = function_name(callback_fn_string)
           if ((typeof(fn_name) == "string") && (fn_name.length > 0)) { cb = window.fn_name }
           else { //we've got an anonyous function source cde def
                cb = eval("(" + callback_fn_string + ")") //need extra parens are veal will error becuase JS is wrong
                if(typeof(cb) != "function"){
                    dde_error("show_window got a callback that doesn't look like a function.")
                }
           }
       }
       else {
           dde_error("In submit_window with bad format for the callback function of: " + callback_fn_string)
       }
    }
    try { cb.call(null, result) }
    catch(err){
        let err_string
        if (typeof(err) == "string") { err_string = err } //weiredly this DOES happen sometimes
        else if (err.message) { err_string = err.message }
        else { err_string = err.toString() }
        dde_error("While calling the show_window handler function of<code>: " + cb.name + "</code>,<br/>" + err_string)
    }
    event.preventDefault()
    event.stopPropagation()
    if (this.oninput) { //work around bug in Chrome 51 June 8 2016 wherein when you have
                        //input of type text, and using my oninput techique, the
                        // upon a keystroke entering a char, the focus changes from the
                        //input elt (and out of the show_window window itself back to the codemirror editor)
                        //just setting the focus in this method doesn't do the trick, I have to
                        //do the setTimeout below to get the focus back to the orig input elt.
        let the_this = this;
        setTimeout(function(){
            if ((the_this) && the_this.ownerDocument.body.contains(the_this)){ //its possible that the win that the_this is in will be closed by the time this code is run.
                           //happens in the case of Human.enter_instruction with immediate_do
                the_this.focus()
            }
        }, 10)
    }
}


//rde.hide_window = function() { $('#jqxwindow').jqxWindow('hide') }
//called from the ui, window_title_index_or_elt can be either a window_index, window title, or elt
//in the window
window.close_window = function(window_title_index_or_elt){ //elt can be a window_index int
    //var window_elt = elt.closest(".show_window")
    //$(window_elt).jqxWindow("close")
    // $(window_elt).remove() //done about near jqx window constructor see .on
    if((window_title_index_or_elt === undefined) ||
       (window_title_index_or_elt === null)){
       window_title_index_or_elt = latest_window_index()
    }
    try {
        if ((typeof(window_title_index_or_elt) == "string") &&
             is_string_a_integer(window_title_index_or_elt)) {
            window_title_index_or_elt = parseInt(window_title_index_or_elt)
        }
        if (typeof(window_title_index_or_elt) == "string") {
            close_windows_of_title(window_title_index_or_elt)
        }
        else if (typeof(window_title_index_or_elt) == "number"){ //ie a window_index
            let win = get_window_of_index(window_title_index_or_elt)
            win.jqxWindow("close")
            remove_window_index_from_show_window_titles_to_window_index_map(window_title_index_or_elt)
        }
        else {
            let win_ind = get_window_index_containing_elt(window_title_index_or_elt)
            remove_window_index_from_show_window_titles_to_window_index_map(win_ind)
            get_jqxw_jq_of_window_containing_elt(window_title_index_or_elt).jqxWindow("close")
        }
    }
    catch(err) { warning("DDE unable to close the window specified in: " + window_title_index_or_elt +
                         "<br/>Perhaps its already closed.")
    }
}

function remove_window_index_from_show_window_titles_to_window_index_map(win_ind){
    for(let title in show_window_titles_to_window_index_map){
        let arr = show_window_titles_to_window_index_map[title]
        let arr_ind = arr.indexOf(win_ind)
        if (arr_ind >= 0) {
            if (arr.length == 1) {
                delete show_window_titles_to_window_index_map[title]
            }
            else { delete arr[arr_ind] }
            return
        }
    }
}

function close_windows_of_title(title){
    let win_inds = show_window_titles_to_window_index_map[title]
    for (let win_ind of win_inds){
        let win = get_window_of_index(win_ind)
        if (win) { try { win.jqxWindow("close") }
                   catch(err) {} //might have already been closed
        }
    }
    delete show_window_titles_to_window_index_map[title]
}

function latest_window_of_title(title){
    let win_inds = show_window_titles_to_window_index_map[title]
    if(win_inds) {
       let last_win_ind = last(win_inds)
       return get_window_of_index(last_win_ind)
    }
    else { return null }
}

//___________SOUND__________
//note Series is not defined in sandbox
window.month_names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September','October', 'November', 'December']

//value can either be some single random js type, or a literal object
//with a field of speak_data, in which case we use that.
function stringify_for_speak(value, recursing=false){
    var result
    if ((typeof(value) == "object") && (value !== null) && value.hasOwnProperty("speak_data")){
        if (recursing) {
            dde_error('speak passed an invalid argument that is a literal object<br/>' +
                      'that has a property of "speak_data" (normally valid)<br/>' +
                      'but whose value itself is a literal object with a "speak_data" property<br/>' +
                      'which can cause infinite recursion.')
        }
        else { return stringify_for_speak(value.speak_data, true) }
    }
    else if (typeof(value) == "string") { result = value }
    else if (value === undefined)  { result = "undefined"}
    else if (value instanceof Date){
        var mon   = value.getMonth()
        var day   = value.getDate()
        var year  = value.getFullYear()
        var hours = value.getHours()
        var mins  = value.getMinutes()
        if (mins == 0) { mins = "oclock, exactly" }
        else if(mins < 10) { mins = "oh " + mins }
        result    = month_names[mon] + ", " + day + ", " + year + ", " + hours + ", " + mins
        //don't say seconds because this is speech after all.
    }
    else if (Array.isArray(value)){
        result = ""
        for (var elt of value){
            result += stringify_for_speak(elt) + ", "
        }
    }
    else {
        result = JSON.stringify(value, null, 2)
        if (result == undefined){ //as happens at least for functions
            result = value.toString()
        }
    }
    return result
}

window.stringify_for_speak = stringify_for_speak

function speak({speak_data = "hello", volume = 1.0, rate = 1.0, pitch = 1.0, lang = "en_US", voice = 0, callback = null} = {}){
    if (arguments.length > 0){
        var speak_data = arguments[0] //, volume = 1.0, rate = 1.0, pitch = 1.0, lang = "en_US", voice = 0, callback = null
    }
    var text = stringify_for_speak(speak_data)
    var msg = new SpeechSynthesisUtterance();
    //var voices = window.speechSynthesis.getVoices();
    //msg.voice = voices[10]; // Note: some voices don't support altering params
    //msg.voiceURI = 'native';
    msg.text   = text
    msg.volume = volume; // 0 to 1
    msg.rate   = rate;   // 0.1 to 10
    msg.pitch  = pitch;  // 0 to 2
    msg.lang   = lang;
    var voices = window.speechSynthesis.getVoices();
    msg.voice  = voices[voice]; // voice is just an index into the voices array, 0 thru 3
    msg.onend  = callback
    speechSynthesis.speak(msg);
    return speak_data
}
window.speak = speak
//________recognize_speech_____________
//all these vars meaningful in ui only.
/*
window.recognition = null
window.recognize_speech_window_index    = null
window.recognize_speech_phrase_callback = null
window.recognize_speech_finish_callback = null
window.recognize_speech_only_once       = null
window.recognize_speech_click_to_talk   = null
window.recognize_speech_last_text       = null
window.recognize_speech_last_confidence = null
window.recognize_speech_finish_array    = []
window.recognize_speech_finish_phrase   = "finish" //set by recognize_speech ui

function init_recognize_speech(){
    recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart  = function(event) {
        recognize_speech_img_id.src = 'mic-animate.gif';
        let instructions
        if ( recognize_speech_only_once ) { instructions = "Speak now.<br/>Be quiet to finish.<br/>" }
        else {
            instructions = "Speak now.<br/>" +
                           "Pause to let DDE process your phrase.<br/>" +
                           'Say <b>' + recognize_speech_finish_phrase + '</b> to end recognition.'
        }
        recognize_speech_instructions_id.innerHTML = instructions
    }

    recognition.onresult = function(event) {
        //out('recognize_speech top of onresult');
        recognize_speech_img_id.src = 'mic.gif';
        recognize_speech_instructions_id.innerHTML = "Stop talking"
        recognize_speech_last_text       = event.results[0][0].transcript //event_to_text(event)
        recognize_speech_last_confidence = event.results[0][0].confidence
        recognize_speech_finish_array.push([recognize_speech_last_text, recognize_speech_last_confidence])
        //out("recognized speech: " + recognize_speech_last_text)
        if (!recognize_speech_only_once && (recognize_speech_last_text == recognize_speech_finish_phrase)){
        }
        else if(recognize_speech_phrase_callback) {
            recognize_speech_phrase_callback(
                                 recognize_speech_last_text,
                                 recognize_speech_last_confidence)
        }
        //typed_input_id.value = text
    }
    
    recognition.onend    = function(event) {
        //out('recognize_speech top of onend');
        if (recognize_speech_only_once) { close_window(recognize_speech_window_index) }
        else if (recognize_speech_last_text == recognize_speech_finish_phrase){
            close_window(recognize_speech_window_index)
            if (recognize_speech_finish_callback){
                recognize_speech_finish_callback(recognize_speech_finish_array)
            }
        }
        else if (recognize_speech_click_to_talk){
            recognize_speech_img_id.src = 'mic.gif';
            recognize_speech_instructions_id.innerHTML = ""
        }
        //Note that its hard to turn off the calling of onstart when the user just closes the
        //window via the window close box. This will do it.
        //but bware, it does NOT call the finish_callback, rather closing the window
        //is like a cancel, ie do nothing.
        else if (is_window_shown(recognize_speech_window_index)){ //more than once AND don't have to click to talk
            start_recognition() //this will set the gif and the instructions
        }
    }

    recognition.onerror  = function(event) {
        if (window["recognize_speech_img_id"]){
            recognize_speech_img_id.src = 'mic.gif';
            recognize_speech_instructions_id.innerHTML = "Stop talking"
        }
        if (is_window_shown(recognize_speech_window_index)){ //don't show this error message if the user closed the window
            out("onerror called with: " + event.error, "red")
        }
    }
} //end init_recognize_speech
//window.init_recognize_speech = init_recognize_speech
//public
function recognize_speech_default_phrase_callback(text, confidence){
    out("text: " + text + "<br/>confidence: " + confidence.toFixed(2))
}
window.recognize_speech_default_phrase_callback = recognize_speech_default_phrase_callback

function recognize_speech({title="Recognize Speech", prompt="",
                           only_once=true, click_to_talk=true,
                           width=400, height=180, x=400, y=200,
                           background_color="rgb(238, 238, 238)",
                           phrase_callback=recognize_speech_default_phrase_callback,
                           finish_callback=null,   //unused if only_once=true
                           finish_phrase="finish", //unused if only_once=true
                           show_window_callback="system_use_only"}={}){
        init_recognize_speech()
        recognize_speech_phrase_callback = phrase_callback
        recognize_speech_finish_callback = finish_callback

        let click_to_talk_html = ""
        if (click_to_talk) {
            click_to_talk_html =  "<input type='button' value='Click to talk'/><br/>"
        }
        //note: this show_window is evaled FIRST (and only) in the ui, so the phrase_callback should be a callback_number
        recognize_speech_finish_array  = []
        recognize_speech_finish_phrase = finish_phrase
        recognize_speech_only_once     = only_once
        recognize_speech_window_index =
           show_window({content: "<div>" + prompt   + "</div>" +
                                 click_to_talk_html +
                                 "<img id='recognize_speech_img_id' src='mic.gif'/>" +
                                 "<span id='recognize_speech_instructions_id'/>",
                        title: title,
                        width: width, height: height, x: x, y: y,
                        background_color: background_color,
                        //callback only would ever get called if there's a click-to-talk button
                        callback: show_window_callback //start_recognition //called from sandbox initially
                        })
        recognize_speech_click_to_talk   = click_to_talk
        if (!click_to_talk) { start_recognition() }
}

window.recognize_speech = recognize_speech

function start_recognition(){
       recognition.start()
}
window.start_recognition = start_recognition
*/

//_______end Chrome Apps recognize_speech_______
//Google cloud rocognize speech
// started from https://github.com/GoogleCloudPlatform/nodejs-docs-samples/blob/master/speech/recognize.js
/*function streamingMicRecognize() {
    const record = require('node-record-lpcm16'); // [START speech_streaming_mic_recognize]
    const Speech = require('@google-cloud/speech'); // Imports the Google Cloud client library
    //const speech = Speech() // Instantiates a client
    const my_path = adjust_path_to_os(__dirname + '/dexter-dev-env-code.json')
    console.log("my_path is" +
        ":" + my_path)
    const speech = Speech({
        projectId: 'dexter-dev-env',
        keyFilename: my_path
    })

    //from https://github.com/GoogleCloudPlatform/google-cloud-node#cloud-speech-alpha
    //const speechClient = speech({
    //    projectId: 'dexter-dev-env',
    //   keyFilename:  adjust_path_to_os(__dirname + '/dexter-dev-env-code.json')
    //})

    const request = { config: { encoding: 'LINEAR16',  sampleRate: 16000 },
                      singleUtterance: false,
                      interimResults: false,
                      verbose: true};
    // Create a recognize stream
    const recognizeStream = speech.createRecognizeStream(request)
            .on('error', console.error)
            .on('data', function(data){console.log(data)})
              //process.stdout.write(data.results)

    // Start recording and send the microphone input to the Speech API
    record.start({
        sampleRate: 16000,
        threshold: 0
    }).pipe(recognizeStream);
    console.log('Listening, press Ctrl+C to stop.');
}

window.streamingMicRecognize = streamingMicRecognize
*/

function beeps(times=1, callback){
    if (times == 0){
        if (callback){
            callback.call()
        }
    }
    else if (times > 0){
        beep()
        setTimeout(function(){beeps(times -1, callback)}, 1000)
    }
}
window.beeps = beeps

window.audioCtx = new window.AudioContext()

function beep({dur = 0.5, frequency = 440, volume = 1, waveform = "triangle", callback = null}={}){
    var oscillator = audioCtx.createOscillator();
    var gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (volume){gainNode.gain.value = volume;};
    if (frequency){oscillator.frequency.value = frequency;}
    if (waveform){oscillator.type = waveform;}
    if (callback){oscillator.onended = callback;}

    oscillator.start();
    setTimeout(function(){oscillator.stop()}, dur * 1000);
}
window.beep = beep

/* a too low volume beep but has a nice tone and "echo" effect.
 //from: http://stackoverflow.com/questions/879152/how-do-i-make-javascript-beep
 var beep_snd = new Audio("data:audio/wav;base64,//uQRAAAAWMSLwUIYAAsYkXgoQwAEaYLWfkWgAI0wWs/ItAAAGDgYtAgAyN+QWaAAihwMWm4G8QQRDiMcCBcH3Cc+CDv/7xA4Tvh9Rz/y8QADBwMWgQAZG/ILNAARQ4GLTcDeIIIhxGOBAuD7hOfBB3/94gcJ3w+o5/5eIAIAAAVwWgQAVQ2ORaIQwEMAJiDg95G4nQL7mQVWI6GwRcfsZAcsKkJvxgxEjzFUgfHoSQ9Qq7KNwqHwuB13MA4a1q/DmBrHgPcmjiGoh//EwC5nGPEmS4RcfkVKOhJf+WOgoxJclFz3kgn//dBA+ya1GhurNn8zb//9NNutNuhz31f////9vt///z+IdAEAAAK4LQIAKobHItEIYCGAExBwe8jcToF9zIKrEdDYIuP2MgOWFSE34wYiR5iqQPj0JIeoVdlG4VD4XA67mAcNa1fhzA1jwHuTRxDUQ//iYBczjHiTJcIuPyKlHQkv/LHQUYkuSi57yQT//uggfZNajQ3Vmz+Zt//+mm3Wm3Q576v////+32///5/EOgAAADVghQAAAAA//uQZAUAB1WI0PZugAAAAAoQwAAAEk3nRd2qAAAAACiDgAAAAAAABCqEEQRLCgwpBGMlJkIz8jKhGvj4k6jzRnqasNKIeoh5gI7BJaC1A1AoNBjJgbyApVS4IDlZgDU5WUAxEKDNmmALHzZp0Fkz1FMTmGFl1FMEyodIavcCAUHDWrKAIA4aa2oCgILEBupZgHvAhEBcZ6joQBxS76AgccrFlczBvKLC0QI2cBoCFvfTDAo7eoOQInqDPBtvrDEZBNYN5xwNwxQRfw8ZQ5wQVLvO8OYU+mHvFLlDh05Mdg7BT6YrRPpCBznMB2r//xKJjyyOh+cImr2/4doscwD6neZjuZR4AgAABYAAAABy1xcdQtxYBYYZdifkUDgzzXaXn98Z0oi9ILU5mBjFANmRwlVJ3/6jYDAmxaiDG3/6xjQQCCKkRb/6kg/wW+kSJ5//rLobkLSiKmqP/0ikJuDaSaSf/6JiLYLEYnW/+kXg1WRVJL/9EmQ1YZIsv/6Qzwy5qk7/+tEU0nkls3/zIUMPKNX/6yZLf+kFgAfgGyLFAUwY//uQZAUABcd5UiNPVXAAAApAAAAAE0VZQKw9ISAAACgAAAAAVQIygIElVrFkBS+Jhi+EAuu+lKAkYUEIsmEAEoMeDmCETMvfSHTGkF5RWH7kz/ESHWPAq/kcCRhqBtMdokPdM7vil7RG98A2sc7zO6ZvTdM7pmOUAZTnJW+NXxqmd41dqJ6mLTXxrPpnV8avaIf5SvL7pndPvPpndJR9Kuu8fePvuiuhorgWjp7Mf/PRjxcFCPDkW31srioCExivv9lcwKEaHsf/7ow2Fl1T/9RkXgEhYElAoCLFtMArxwivDJJ+bR1HTKJdlEoTELCIqgEwVGSQ+hIm0NbK8WXcTEI0UPoa2NbG4y2K00JEWbZavJXkYaqo9CRHS55FcZTjKEk3NKoCYUnSQ0rWxrZbFKbKIhOKPZe1cJKzZSaQrIyULHDZmV5K4xySsDRKWOruanGtjLJXFEmwaIbDLX0hIPBUQPVFVkQkDoUNfSoDgQGKPekoxeGzA4DUvnn4bxzcZrtJyipKfPNy5w+9lnXwgqsiyHNeSVpemw4bWb9psYeq//uQZBoABQt4yMVxYAIAAAkQoAAAHvYpL5m6AAgAACXDAAAAD59jblTirQe9upFsmZbpMudy7Lz1X1DYsxOOSWpfPqNX2WqktK0DMvuGwlbNj44TleLPQ+Gsfb+GOWOKJoIrWb3cIMeeON6lz2umTqMXV8Mj30yWPpjoSa9ujK8SyeJP5y5mOW1D6hvLepeveEAEDo0mgCRClOEgANv3B9a6fikgUSu/DmAMATrGx7nng5p5iimPNZsfQLYB2sDLIkzRKZOHGAaUyDcpFBSLG9MCQALgAIgQs2YunOszLSAyQYPVC2YdGGeHD2dTdJk1pAHGAWDjnkcLKFymS3RQZTInzySoBwMG0QueC3gMsCEYxUqlrcxK6k1LQQcsmyYeQPdC2YfuGPASCBkcVMQQqpVJshui1tkXQJQV0OXGAZMXSOEEBRirXbVRQW7ugq7IM7rPWSZyDlM3IuNEkxzCOJ0ny2ThNkyRai1b6ev//3dzNGzNb//4uAvHT5sURcZCFcuKLhOFs8mLAAEAt4UWAAIABAAAAAB4qbHo0tIjVkUU//uQZAwABfSFz3ZqQAAAAAngwAAAE1HjMp2qAAAAACZDgAAAD5UkTE1UgZEUExqYynN1qZvqIOREEFmBcJQkwdxiFtw0qEOkGYfRDifBui9MQg4QAHAqWtAWHoCxu1Yf4VfWLPIM2mHDFsbQEVGwyqQoQcwnfHeIkNt9YnkiaS1oizycqJrx4KOQjahZxWbcZgztj2c49nKmkId44S71j0c8eV9yDK6uPRzx5X18eDvjvQ6yKo9ZSS6l//8elePK/Lf//IInrOF/FvDoADYAGBMGb7FtErm5MXMlmPAJQVgWta7Zx2go+8xJ0UiCb8LHHdftWyLJE0QIAIsI+UbXu67dZMjmgDGCGl1H+vpF4NSDckSIkk7Vd+sxEhBQMRU8j/12UIRhzSaUdQ+rQU5kGeFxm+hb1oh6pWWmv3uvmReDl0UnvtapVaIzo1jZbf/pD6ElLqSX+rUmOQNpJFa/r+sa4e/pBlAABoAAAAA3CUgShLdGIxsY7AUABPRrgCABdDuQ5GC7DqPQCgbbJUAoRSUj+NIEig0YfyWUho1VBBBA//uQZB4ABZx5zfMakeAAAAmwAAAAF5F3P0w9GtAAACfAAAAAwLhMDmAYWMgVEG1U0FIGCBgXBXAtfMH10000EEEEEECUBYln03TTTdNBDZopopYvrTTdNa325mImNg3TTPV9q3pmY0xoO6bv3r00y+IDGid/9aaaZTGMuj9mpu9Mpio1dXrr5HERTZSmqU36A3CumzN/9Robv/Xx4v9ijkSRSNLQhAWumap82WRSBUqXStV/YcS+XVLnSS+WLDroqArFkMEsAS+eWmrUzrO0oEmE40RlMZ5+ODIkAyKAGUwZ3mVKmcamcJnMW26MRPgUw6j+LkhyHGVGYjSUUKNpuJUQoOIAyDvEyG8S5yfK6dhZc0Tx1KI/gviKL6qvvFs1+bWtaz58uUNnryq6kt5RzOCkPWlVqVX2a/EEBUdU1KrXLf40GoiiFXK///qpoiDXrOgqDR38JB0bw7SoL+ZB9o1RCkQjQ2CBYZKd/+VJxZRRZlqSkKiws0WFxUyCwsKiMy7hUVFhIaCrNQsKkTIsLivwKKigsj8XYlwt/WKi2N4d//uQRCSAAjURNIHpMZBGYiaQPSYyAAABLAAAAAAAACWAAAAApUF/Mg+0aohSIRobBAsMlO//Kk4soosy1JSFRYWaLC4qZBYWFRGZdwqKiwkNBVmoWFSJkWFxX4FFRQWR+LsS4W/rFRb/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////VEFHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAU291bmRib3kuZGUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMjAwNGh0dHA6Ly93d3cuc291bmRib3kuZGUAAAAAAAAAACU=");

 function beep_once(){
 beep_snd.play();
 }
 */
//________show_page__________
function show_page(url, options={x:0, y:0, width: 800, height: 600}){
    if (url.indexOf("://") == -1){
        url = "http://" + url
    }
    if (!options) { options = {} }
    //electron's BrowserWindow options must have both x & y or neighter.
    //that's an unnecessary restriction so I fix this deficiency in electron below.
    //if (options.x || (options.x == 0)) {
    //    if (!options.y && (options.y != 0)) { options.y = 0 }
    //}
    //if (options.y || (options.y == 0)) {
    //    if (!options.x  && (options.x != 0)) { options.x = 0 }
    //}
    if (!options.x)      { options.x = 0 }
    if (!options.y)      { options.y = 0 }
    if (!options.width)  { options.width  = 800 } //does not allow width to be 0. Is that good? a 0 width means the window is invisible
    if (!options.height) { options.height = 600 } //does not allow width to be 0. Is that good? a 0 width means the window is invisible
    if (!options.title)  { options.title = url }
   // window.open(url) //show_url(url) //fails in electron
    ipcRenderer.sendSync('show_page', url, options) //see main.js "show_page"
    return url
}
window.show_page = show_page


/*
function get_page(url, callback=out, error_callback=get_page_error_callback){//in sandbox, callback is a fn, in ui, its an integer
    if (in_ui()){
        try{
            fetch(url)
                .then(function(response) {
                    if (response.ok) {  return response.text()  }
                    else {
                        cbr.perform_callback(error_callback, url, response.statusText)

                    }
                }).then(function(text){
                //console.log("in 2nd then")
                //out("in 2nd then")
                //out(text)
                cbr.perform_callback(callback, text)
            }).catch(function(err) { //this does not catch error 404 file not found. Stupid!
                cbr.perform_callback(error_callback, url, err.message)
            })
        }
        catch(e) {
            cbr.perform_callback(error_callback, url, err)
        }
    }
    else {
        var callback_number = cbr.store_callback(callback)
        var error_callback_number = cbr.store_callback(error_callback)
        post_to_ui({name: "get_page", url: url, callback: callback_number, error_callback: error_callback_number})
    }
}*/

//starts from sandbox
//if callback not passed, this is synchronous and just returns the
//contents of the url.
//if callback is passed, it takes 3 args, error, response_object, body
//where 'body" is the contents of the url"
function get_page_async(url_or_options, callback){
        //https://www.npmjs.com/package/request documents reqeust
        //as taking args of (options, cb) but the actual
        //fn itself has params(uri, options, cb)
        //request(url_or_options, callback) //function(error, response, body){console.log(body)}
        var the_url
        var the_options
        request(url_or_options, callback)
}
window.get_page_async = get_page_async

//synchronous.
//bret's recommended I use npm sync-request BUT that takes different
//args/options than standard request which I use for get_page_async
//and I don't want users to have to use different args for the 2 fns,
//so I stick with my "main.js" trick for async here.
function get_page(url_or_options){
        console.log("rend get_page sync: " + url_or_options)
        const reply = ipcRenderer.sendSync('get_page', url_or_options) //see main.js "get_page"
        console.log("rend get_page sync back from: " + url_or_options + " with: " + reply.substring(0, 10))
        return reply
}
window.get_page = get_page


//returns null if it can't get the data, else an array
//of 2 strings a la ["1.0.2, "2017-03-23T13:02:59"]
window.latest_release_version_and_date = function(callback){
    //hitting the below url from a browser works, but not programmatically
    //unless you have a header of the below usr agent.
    const browser_user_agent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36'
    get_page_async({url: "https://api.github.com/repos/cfry/dde/releases/latest",
                        headers: {"user-agent": browser_user_agent}},
                        callback)
}

function make_url(url, arguments) {
    let index_of_protocol = url.indexOf("://")
    if ((index_of_protocol == -1) || (index_of_protocol > 16)) {
        url = "http://" + url
    }
    if (arguments){
        let arg_string = ""
        if (typeof(arguments) == "object") { //presume we've got a literal object of args
           var on_first = true
           for (let key in arguments){
               let val = arguments[key]
               arg_string += (on_first ? "" : "&") + key + "=" + val
               on_first = false
           }
        }
        else if (typeof(arguments) == "string") { arg_string = arguments }
        else {
            dde_error("The 2nd argument to make_url, if passed, should be a string or a literal object, " +
                      "but it is neither: " + arguments)
        }
        if (arg_string.length > 0){
            if (last(url) == "?"){ url = url.substring(0, url.length - 1) }
            if (arg_string[0] == "?") { arg_string = arg_string.substring(1) }
            url = url + "?" + arg_string
        }
    }
    return url
}
window.make_url = make_url

//hack! no good way to do this but go after an existing elt that uses
//a particular "class" that I'm interrested in, and grab its
//css. Need to use jquery as body_id.style.background-color doesn't get it
function window_frame_background_color(){
    return $("#body_id").css("background-color") // ie "rgb(123, 45, 67))
}

function pane_header_background_color(){
    return $(".pane_header_wrapper").css("background-color")
}

function menu_background_color(){
    return $("#js_menubar_id").css("background-color") // ie "rgb(123, 45, 67))
}

function button_background_color(){
    return $("#eval_id").css("background-color") // ie "rgb(123, 45, 67))
}
//beware property_name muxt be camel cased (lower case first char, no dashes
//so background_color mush be represented as backgroundColor.
function set_css_property(selector, property_name, new_value){
    let sss = document.styleSheets
    for (let ss_index = 0; ss_index < sss.length; ss_index++){
        let ss = sss[ss_index]
        if (ss.href && ss.href.endsWith("styles.css")) { //dde's style sheet name
            let the_rules = ss.rules
            for(let rule_index = 0; rule_index < the_rules.length; rule_index++){
                let the_rule = the_rules[rule_index]
                if (the_rule.selectorText == selector){
                    the_rule.style[property_name] = new_value
                    return
                }
            }
        }
    }
}

function set_window_frame_background_color(new_color){
    $(".window_frame").css("background-color", new_color)
    set_css_property(".window_frame",
                     "backgroundColor", //must use the camel cased version of the name, no dashes
                      new_color)
}
window.set_window_frame_background_color = set_window_frame_background_color


function set_pane_header_background_color(new_color){
    $(".pane_header_wrapper").css("background-color", new_color)
    set_css_property(".pane_header_wrapper",
                     "backgroundColor", //must use the camel cased version of the name, no dashes
        new_color)
}
window.set_pane_header_background_color = set_pane_header_background_color

function set_menu_background_color(new_color){
    $(".dde_menu").css("background-color", new_color)
    set_css_property(".dde_menu",
                     "backgroundColor", //must use the camel cased version of the name, no dashes
                     new_color)
}
window.set_menu_background_color = set_menu_background_color

function set_button_background_color(new_color){
    $("button").css("background-color", new_color)
    set_css_property("button",
                     "backgroundColor", //must use the camel cased version of the name, no dashes
                     new_color)

    $("input[type=button]").css("background-color", new_color)
    set_css_property('input[type="submit"]', //submit must be double quoted
        "backgroundColor", //must use the camel cased version of the name, no dashes
        new_color)

}
window.set_button_background_color = set_button_background_color


function insert_color_cb(vals){
    if(vals.clicked_button_value == "Insert Color"){
        let new_color = vals.my_color
        if(window.insert_color_cb_remove_sharp_sign){
            new_color = new_color.substring(1)
        }
        if (window.insert_color_cb_add_quotes) {
            new_color = window.insert_color_cb_add_quotes + new_color +
                        window.insert_color_cb_add_quotes
        }
        Editor.insert(new_color)
    }
}

window.insert_color_cb = insert_color_cb
window.insert_color_cb_remove_sharp_sign = false
window.insert_color_cb_add_quotes         = false

function insert_color(){
    let orig_color = Editor.get_javascript(true).trim()
    let hex_color_name_maybe = Series.color_name_to_hex(orig_color) //if orig_color == "green" then this wil return something like "#00FF00"
    if (hex_color_name_maybe) { orig_color = hex_color_name_maybe}
    if (orig_color == "") { orig_color = "#FFFFFF" } //white
    if (starts_with_one_of(orig_color, ["'", '"'])) {
        window.insert_color_cb_add_quotes =  orig_color[0]
        orig_color = orig_color.substring(1, orig_color.length - 1) //assume it has ending quote too
    }
    else { window.insert_color_cb_add_quotes = false }
    if (starts_with_one_of(orig_color, ["#", "rgb"])) {
        window.insert_color_cb_remove_sharp_sign = false
    }
    else { orig_color = "#" + orig_color
        window.insert_color_cb_remove_sharp_sign = true
    }
    show_window(
        {title: "Choose a color to insert",
            content: '<ol><li>Click <input type="color" name="my_color" value="' +
            orig_color + '"/> to edit color.</li>' +
            '<li>Select a color and <br/>close the pop up color dialog.</li>' +
            '<li>Click <input type="submit" value="Cancel"/> or ' +
            '<input type="submit" value="Insert Color"/></li></ul>',
            width:300, height:175, x:100, y:100,
            callback: insert_color_cb})
}
window.insert_color = insert_color


//fixes broken Electron prompt See main.js for more code and doc
window.prompt = function(description="", default_value=""){
    let obj
    if(typeof(description) == "string"){
        obj = {description: description,
               default_value: default_value,
              }
    }
    else { obj = description }
    if(!obj.hasOwnProperty("title"))                         { obj.title = "DDE Prompt" }
    if(!obj.hasOwnProperty("description"))                   { obj.description = "" }
    if(!obj.hasOwnProperty("default_value"))                 { obj.default_value = "" }
    if(!obj.hasOwnProperty("x"))                             { obj.x = 200 }
    if(!obj.hasOwnProperty("y"))                             { obj.y = 200 }
    if(!obj.hasOwnProperty("width"))                         { obj.width =  400 }
    if(!obj.hasOwnProperty("height"))                        { obj.height = 200 }
    if(!obj.hasOwnProperty("color"))                         { obj.color = "black" }
    if(!obj.hasOwnProperty("background_color"))              { obj.background_color = "#DDDDDD" }
    if(!obj.hasOwnProperty("window_frame_background_color")) { obj.window_frame_background_color = window_frame_background_color() }
    if(!obj.hasOwnProperty("button_background_color"))       { obj.button_background_color = button_background_color() }
    obj.x = obj.x + persistent_get("dde_window_x") //make x and y relative to the dde window.
    obj.y = obj.y + persistent_get("dde_window_y")
    console.log(obj)
    let return_val = ipcRenderer.sendSync('prompt', obj)
    console.log("return_val")
    console.log(return_val)
    return return_val
}

var {persistent_get, persistent_set} = require("./core/storage")
var {warning, function_name, is_string_a_integer, is_string_a_number, starts_with_one_of,
    stringify_value, value_of_path} = require("./core/utils.js")

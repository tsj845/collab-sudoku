/**@type {HTMLDivElement} */
const name_div = document.getElementById("name-div");
/**@type {HTMLDivElement} */
const board_div = document.getElementById("board");
/**@type {HTMLUListElement} */
const messages = document.getElementById("messages-container");
/**@type {HTMLDivElement} */
const cursor = document.getElementById("cursor");
const socket = io();

function submit_nick () {
    socket.emit('nick-submitted', document.getElementById('name-entry').value, document.getElementById('pswd-entry').value);
}

// controls what a person can and can't do, because people are jerks
let perms = 0;

let booted = false;

let position = [0, 0];

function message (text, color) {
    /**@type {HTMLParagraphElement} */
    const message = document.createElement("p");
    message.textContent = text;
    message.style.setProperty("--color", format_css_color(color));
    messages.appendChild(message);
    message.addEventListener("animationend", ()=>{rem_message(message)});
}

// goes left, top, right, bottom
const bigtableofsides = {
    "00":"1100",
    "10":"0100",
    "20":"0110",
    "30":"1100",
    "40":"0100",
    "50":"0110",
    "60":"1100",
    "70":"0100",
    "80":"0110",
    "01":"1000",
    "11":"0000",
    "21":"0010",
    "31":"1000",
    "41":"0000",
    "51":"0010",
    "61":"1000",
    "71":"0000",
    "81":"0010",
    "02":"1001",
    "12":"0001",
    "22":"0011",
    "32":"1001",
    "42":"0001",
    "52":"0011",
    "62":"1001",
    "72":"0001",
    "82":"0011",
    "03":"1100",
    "13":"0100",
    "23":"0110",
    "33":"1100",
    "43":"0100",
    "53":"0110",
    "63":"1100",
    "73":"0100",
    "83":"0110",
    "04":"1000",
    "14":"0000",
    "24":"0010",
    "34":"1000",
    "44":"0000",
    "54":"0010",
    "64":"1000",
    "74":"0000",
    "84":"0010",
    "05":"1001",
    "15":"0001",
    "25":"0011",
    "35":"1001",
    "45":"0001",
    "55":"0011",
    "65":"1001",
    "75":"0001",
    "85":"0011",
    "06":"1100",
    "16":"0100",
    "26":"0110",
    "36":"1100",
    "46":"0100",
    "56":"0110",
    "66":"1100",
    "76":"0100",
    "86":"0110",
    "07":"1000",
    "17":"0000",
    "27":"0010",
    "37":"1000",
    "47":"0000",
    "57":"0010",
    "67":"1000",
    "77":"0000",
    "87":"0010",
    "08":"1001",
    "18":"0001",
    "28":"0011",
    "38":"1001",
    "48":"0001",
    "58":"0011",
    "68":"1001",
    "78":"0001",
    "88":"0011"
};

function __boot (color, board) {
    for (let y = 0; y < 9; y ++) {
        for (let x = 0; x < 9; x ++) {
            /**@type {HTMLDivElement} */
            const space = document.createElement("div");
            space.style.setProperty("--y", y);
            space.style.setProperty("--x",  x);
            space.className = "board_space";
            space.appendChild(document.createElement("div"));
            const er = document.createElement("div");
            er.className = "inc";
            space.appendChild(er);
            console.log(space.children);
            const st = bigtableofsides[x.toString()+y.toString()];
            if (st[0] === "1") {
                space.classList.toggle("bs-bl");
            }
            if (st[1] === "1") {
                space.classList.toggle("bs-bt");
            }
            if (st[2] === "1") {
                space.classList.toggle("bs-br");
            }
            if (st[3] === "1") {
                space.classList.toggle("bs-bb");
            }
            // space.textContent = board[y][x] === "0" ? "" : board[y][x];
            // space.textContent = `${x*y%9}`;
            board_div.appendChild(space);
        }
    }
    cursor.style.setProperty("--color", format_css_color(color));
    /**@function */
    let draw_edit_interface = () => {};
    /**@function */
    let draw_sudo_interface = () => {};
    if (perms > 0) {
        draw_edit_interface();
    }
    if (perms > 1) {
        draw_sudo_interface();
    }
    draw_edit_interface = undefined;
    draw_sudo_interface = undefined;
    booted = true;
    update_board(board);
}

function update_board (board) {
    if (!booted) {
        return;
    }
    for (let y = 0; y < 9; y ++) {
        for (let x = 0; x < 9; x ++) {
            let val = "";
            let pcl = "empty";
            if (board.constant[y][x] !== "0") {
                val = board.constant[y][x];
                pcl = "const";
            } else if (board.confirmed[y][x] !== "0") {
                val = board.confirmed[y][x];
                pcl = "confm";
            } else if (board.test[y][x] !== "0") {
                val = board.test[y][x];
                pcl = "testv";
            } else if (board.normal[y][x] !== "0") {
                val = board.normal[y][x];
                pcl = "norml";
            }
            board_div.children[y*9+x].classList.remove("empty", "const", "confm", "testv", "norml", "incor");
            if (board.incorrect[y][x] !== "0") {
                board_div.children[y*9+x].classList.add("incor");
            }
            board_div.children[y*9+x].classList.add(pcl);
            board_div.children[y*9+x].children[0].textContent = val;
            // board_div.children[y*9+x].textContent = val;
        }
    }
}

/**
 * formats for some special css
 * @param {String} color 
 * @returns {String}
 */
function format_css_color (color) {
    console.log(color);
    if (color[0] == "#") {
        color = color.slice(1);
    }
    if (color.length === 3) {
        color = color[0]+color[0]+color[1]+color[1]+color[2]+color[2];
    }
    t = "0123456789abcdef";
    return `${t.indexOf(color[0])*16+t.indexOf(color[1])}, ${t.indexOf(color[2])*16+t.indexOf(color[3])}, ${t.indexOf(color[4])*16+t.indexOf(color[5])}`;
}

socket.on("nick-accepted", (permlevel, color, board) => {
    name_div.hidden = true;
    perms = permlevel;
    __boot(color, board);
});

socket.on("update", (board) => {
    update_board(board);
});

socket.on("player disconnect", (nickname, color) => {
    message(`${nickname} left the game`, color);
});

socket.on("player connect", (nickname, color) => {
    message(`${nickname} joined the game`, color);
});

function move (x, y) {
    if (position[0]+x < 0 || position[0]+x > 8 || position[1]+y < 0 || position[1]+y > 8) {
        return;
    }
    position[0] = position[0] + x;
    position[1] = position[1] + y;
    cursor.style.setProperty("--x", position[0]);
    cursor.style.setProperty("--y", position[1]);
    socket.emit("move", position.join(""));
}

document.addEventListener("keydown", (e) => {
    if (!"code" in e) {
        return;
    }
    const key = e.code.toString();
    if (key === "ArrowLeft") {
        move(-1, 0);
    } else if (key === "ArrowRight") {
        move(1, 0);
    } else if (key === "ArrowUp") {
        move(0, -1);
    } else if (key === "ArrowDown") {
        move(0, 1);
    }
});
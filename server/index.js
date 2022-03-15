import express from 'express'
import {Server} from 'socket.io'
import http from 'http'
import path from 'path'
import {dirname} from 'path'
import {fileURLToPath} from 'url'

import {config} from 'dotenv';
config();

const server = express()
const HTTPServer = new http.Server(server)
const gsocket = new Server(HTTPServer)
const __dirname = dirname(fileURLToPath(import.meta.url))
// associates socket ids to nicknames
let clients = {};
// associates socket ids to colors
let colors = {};
// associates socket ids to permissions
let ptable = {};

/**@type {Array<Array<Number>>} */
let correct_board = [];

/**@type {{constant : Array<Array<Number>>, confirmed : Array<Array<Number>>, test : Array<Array<Number>>, normal : Array<Array<Number>>, incorrect : Array<Array<Number>>}} */
let sudoku_board = {};

/**
 * board docs, in decending order of importance, higher layers override lower layers
 * constant - given values at the start of the game
 * confirmed - values that have been checked or revealed
 * test - testing values that can be wiped
 * normal - standard entries
 * 
 * incorrect - hidden layer, when a space is 1 that space is marked incorrect otherwise nothing is shown, solely used to give feedback on the "check" operation
 */

for (const i in ["constant", "confirmed", "test", "normal", "incorrect"]) {
    let seeder_board = [];
    for (let y = 0; y < 9; y ++) {
        let lst = [];
        for (let x = 0; x < 9; x ++) {
            lst.push("0");
        }
        seeder_board.push(lst);
    }
    sudoku_board[["constant", "confirmed", "test", "normal", "incorrect"][i]] = seeder_board;
}

for (let y = 0; y < 9; y ++) {
    let lst = [];
    for (let x = 0; x < 9; x ++) {
        lst.push(0);
    }
    correct_board.push(lst);
}

/**
 * 
 * @param {Number} x 
 * @param {Number} y 
 * @return {Number}
 */
function isolate (x, y) {
    if (sudoku_board.constant[y][x] > 0) {
        return 4;
    }
    if (sudoku_board.confirmed[y][x] > 0) {
        return 3;
    }
    if (sudoku_board.test[y][x] > 0) {
        return 2;
    }
    if (sudoku_board.normal[y][x] > 0) {
        return 1;
    }
    return 0;
}

server.use('/assets', express.static(__dirname + '/../assets/'))
server.use(express.json())

function send(res, file) {
    return res.sendFile(file, {root: path.join(__dirname + '/../views')})
}

/**
 * 
 * @param {Number} h 
 * @param {Number} s 
 * @param {Number} l
 * @returns {String} 
 */
 function hsl_to_rgb (h, s, l) {
    h = Math.floor(h);
    s = Math.floor(s*100)/100;
    l = Math.floor(l*100)/100;
    h = h % 360;
    if (h < 0) {
        h += 360;
    }
    const c = (1 - Math.abs(l * 2 - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let t = [];
    if (h < 60) {
        t = [c, x, 0];
    } else if (h < 120) {
        t = [x, c, 0];
    } else if (h < 180) {
        t = [0, c, x];
    } else if (h < 240) {
        t = [0, x, c];
    } else if (h < 300) {
        t = [x, 0, c];
    } else {
        t = [c, 0, x];
    }
    t = [Math.floor((t[0]+m)*255), Math.floor((t[1]+m)*255), Math.floor((t[2]+m)*255)];
    let co = "0123456789abcdef";
    return `#${co[(t[0]-(t[0]%16))/16]+co[t[0]%16]}${co[(t[1]-(t[1]%16))/16]+co[t[1]%16]}${co[(t[2]-(t[2]%16))/16]+co[t[2]%16]}`;
}

function name_exists (id, nick) {
    if (id in clients) {
        return true;
    }
    for (const i in clients) {
        if (clients[id] === nick) {
            return true;
        }
    }
    return false;
}

function generateColor () {
    return hsl_to_rgb(Math.random()*360, Math.max(Math.random(), 0.5), Math.max(Math.min(Math.random(), 0.75), 0.25));
}

gsocket.on('connection', (socket) => {

    socket.on("nick-submitted", (nickname, password) => {
        if (name_exists(socket.id, nickname) || (process.env.JOINPOLICY[0] !== "a" && password !== process.env.PASSCODE && password !== process.env.EDITPASS && password !== process.env.SUDOPASS)) {
            console.log(name_exists(socket.id, nickname));
            socket.emit("nick-taken");
            return;
        }
        if (password === process.env.SUDOPASS) {
            ptable[socket.id] = 2;
        } else if (process.env.JOINPOLICY[1] === "1" || password === process.env.EDITPASS) {
            ptable[socket.id] = 1;
        } else {
            ptable[socket.id] = 0;
        }
        clients[socket.id] = nickname;
        colors[socket.id] = generateColor();
        socket.emit("nick-accepted", ptable[socket.id], colors[socket.id], sudoku_board);
        socket.broadcast.emit('player connect', nickname, colors[socket.id]);
    });

    socket.on("move", (position) => {
        socket.broadcast.emit("move", position);
    });

    socket.on("change", (position, mode, value) => {
        if (ptable[socket.id] < 1) {
            return;
        }
        if (isolate(Number(position[0]), Number(position[1])) > 2) {
            return;
        }
        sudoku_board[mode][position[1]][position[0]] = value;
        sudoku_board.incorrect[position[1]][position[0]] = "0";
        gsocket.emit("update", sudoku_board);
    });

    socket.on("check", (position) => {
        if (ptable[socket.id] < 2) {
            return;
        }
        if (isolate(Number(position[0]), Number(position[1])) === 1) {
            if (sudoku_board.normal[y][x] === correct_board[y][x]) {
                sudoku_board.confirmed[y][x] = sudoku_board.normal[y][x];
            } else {
                sudoku_board.incorrect[y][x] = 1;
            }
            gsocket.emit("update", sudoku_board);
        }
    });

    socket.on("reveal", (position) => {
        if (ptable[socket.id] < 2) {
            return;
        }
        if (isolate(Number(position[0]), Number(position[1])) <= 1) {
            sudoku_board.incorrect[y][x] = 0;
            sudoku_board.confirmed[y][x] = correct_board[y][x];
            gsocket.emit("update", sudoku_board);
        }
    });

    socket.on('disconnect', () => {
        if (socket.id in clients) {
            socket.broadcast.emit('player disconnect', clients[socket.id], colors[socket.id]);
            delete clients[socket.id];
            delete colors[socket.id];
            delete ptable[socket.id];
        }
    })
})

server.get('/', (req, res) => {
    send(res, 'index.html')
})

HTTPServer.listen(Number(process.env.PORT), () => {
    console.log("Started HTTP server. Port:", Number(process.env.PORT));
})
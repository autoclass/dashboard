import './index.scss';
import * as $ from 'jquery';
import 'bootstrap';
import './index.html';

const io = require('socket.io-client');

function listItems(items) {
    return items?.map(i => `<li class="list-group-item text-muted text-monospace">
                                ${i}
                                <button type="button" class="close" aria-label="Delete" data-id="${i}" onclick="(function n(){v = new Event('playSound'); v.whom=this; document.dispatchEvent(v)}).call(this)">
                                    <svg width="1em" height="1em" viewBox="0 0 16 16" class="bi bi-play-fill" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M11.596 8.697l-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
                                    </svg>
                                </button>
                            </li>`) || "";
}

const logBuffer = {
    buf: [],
    listeners: [],
    maxSize: 500,
    push(str) {
        this.buf.push(str);
        this.listeners.forEach(f => f(str, this.buf));
        if (this.maxSize === this.buf.length) {
            this.buf.shift();
        }
    }
};

let socket;
let sounds;

const timestamp = () => new Date().toTimeString().split(' ')[0]

$(
    () => {
        const $logWindow = $('#log-window');
        logBuffer.listeners.push((_, buf) => {
            $logWindow.text(buf.reduce((acc, x) => acc + x + '\n', '')).scrollTop($logWindow[0].scrollHeight - $logWindow.height())
        });
    }
)

function addToLog(string) {
    logBuffer.push(`[${timestamp()}] ${string}`);
}

let classes;
let platforms = [];

const setupSock = _sock => {
    _sock.on('connect', () => {
        addToLog(`Connected!`);
    });
    _sock.on('disconnect', error => {
        addToLog(`Disconnected! (${error})`);
        console.error("Disconnected!", error)
    });
    _sock.on('connect_error', error => {
        addToLog(`Could not connect! (${error})!`);
        console.error("Could not connect!", error)
    });

    _sock.on('update users', (s) => {
        sounds = new Map(s);
        addToLog(`Updated user/sounds`);

        $('#single-user-select').html(
            Array.from(sounds.keys())
                .map(u => `<option>${u}</option>`)
                .reduce((acc, x) => acc + x, '')
        ).change();

        console.debug(sounds);
    });

    _sock.on('config', config => {
        classes = config;
        platforms = Array.from(new Set(config.map(c => c.platform)));

        const opts = config.map(c => `<option>${c.className}</option>`).reduce((acc, x) => acc + x, "");
        const platformOpts = platforms.map(c => `<option>${c}</option>`).reduce((acc, x) => acc + x, "");

        $('#all-user-existing-class').html(opts);
        $('#single-user-existing-class').html(opts);
        $('#all-user-custom-class-platform').html(platformOpts);
        $('#single-user-custom-class-platform').html(platformOpts);
    })
}

$(
    () => {
        $('#all-user-existing-class-join').click(e => {
            e.preventDefault();
            const selectedClass = classes.find(x => x.className === $('#all-user-existing-class').val());
            socket.emit('join', {platform: selectedClass.platform, opts: selectedClass.opts});
        });

        $('#all-user-custom-class-join').click(e => {
            e.preventDefault();
            socket.emit('join', {
                platform: $('#all-user-custom-class-platform').val(),
                opts: $('#all-user-custom-class-url').val()
            });
        });

        $('#all-user-leave').click(e => {
            e.preventDefault();
            socket.emit('leave');
        })
    }
);

$(
    () => {
        $('#single-user-existing-class-join').click(e => {
            e.preventDefault();
            const selectedClass = classes.find(x => x.className === $('#single-user-existing-class').val());
            const target = $('#single-user-select').val();
            socket.emit('join', {platform: selectedClass.platform, opts: selectedClass.opts, target});
        });

        $('#single-user-custom-class-join').click(e => {
            e.preventDefault();
            const target = $('#single-user-select').val();
            socket.emit('join', {
                platform: $('#single-user-custom-class-platform').val(),
                opts: $('#single-user-custom-class-url').val(),
                target
            });
        });

        $('#single-user-leave').click(e => {
            e.preventDefault();
            const target = $('#single-user-select').val();
            socket.emit('leave', {target});
        });

        $('#single-user-unmute').click(e => {
            e.preventDefault();
            const target = $('#single-user-select').val();
            socket.emit('unmute', {length: JSON.parse($('#single-user-unmute-seconds').val()), target});
        });
    }
);

$(
    () => {
        $('#connect-btn').click(e => {
            e.preventDefault();
            socket && socket.close();
            const socketUrl = $('#socketUrl').val(),
                token = $('#serverSecret').val();
            socket = io(socketUrl, {query: {token}});
            setupSock(socket);
        });
    }
);

$(
    () => {
        const $select = $('#single-user-select');
        $select.change(() => {
            $('#sound-list').html(
                listItems(sounds.get($select.val()))
            )
        });
    }
)

$(
    () => {
        $(document).on("playSound", e => {
            const sound = e.originalEvent.whom.getAttribute('data-id'),
                target = $('#single-user-select').val();
            socket.emit('play', {target, sound});
            addToLog(`Played sound '${sound}' to ${target}`);
        })
    }
)

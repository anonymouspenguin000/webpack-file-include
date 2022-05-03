const fs = require('fs');
const path = require('path');

const strConfig = {
    includeWord: 'include',
    tag: [ '<&&', '&&>' ],
    errWrap: [ '[[[', ']]]' ]
};
const reg = {
    parts: {
        string: /("|')(.*?)("|')/,
        json: /[{\[]{1}([,:{}\[\]0-9.\-+Eaeflnr-u \n\r\t]|".*?")+[}\]]{1}/,
        get parseEval() {
            let _p = this;
            return new RegExp(`(?<=${ strConfig.tag[0] }=\s*).+?(?=\s*=${ strConfig.tag[1] })`, 's');
        }
    },
    get include() {
        let _p = this.parts;
        return new RegExp(`${ strConfig.tag[0] }${ strConfig.includeWord }\\(${ _p.string.source }(,\\s*${ _p.json.source })?\\)${ strConfig.tag[1]}`, 'gi');
    },
    get eval() {
        let _p = this.parts;
        return RegExp(`${ strConfig.tag[0] }=.+?(=${ strConfig.tag[1] })`, 'gis');
    }
};

function a$b_(obj, ...keys) {
    let curr = obj;
    for (let k of keys) {
        curr = curr[k];
        if (curr === undefined) break;
    }
    return curr;
}
function concatRegexp(...reg) {
    let flags = '';
    let source = '';
    for (let r of reg) {
        r = new RegExp(r);
        flags = Array.from( new Set((flags + r.flags).split('')) ).join('');
        source += r.source;
    }
    return new RegExp(source, flags);
}
function xeval(str) {
    try {
        const ev = eval(str);
        return ev === undefined ? '' : ev;
    } catch (e) {
        return printErr(e);
    }
}
function printErr(e) {
    return strConfig.errWrap[0] + e + strConfig.errWrap[1];
}

function parseSyntax(str) {
    let relpath, options, err;
    try {
        relpath = str.match(reg.parts.string)[0].slice(1, -1);
        options = JSON.parse((str.match(reg.parts.json) || ['{}'])[0]);
    } catch (e) {
        err = e;
    }
    
    return { relpath, options, err };
}
function parseFile(html, context, options) {
    html += '';
    
    html = html.replace(reg.eval, function (matched) {
        const uev = matched.match(reg.parts.parseEval);
        let res = xeval.apply(options, uev);
        return res;
    });
    
    html = html.replace(reg.include, function (matched) {
        let { relpath, options, err: parseErr } = parseSyntax(matched);
        
        const filepath = path.resolve(context, relpath);
        const filedir = path.dirname(filepath);
        
        
        let file_content;
        try {
           file_content = fs.readFileSync(filepath);
        } catch (e) {
            parseErr = parseErr || e;
        }
        return parseErr ? printErr(parseErr) : parseFile(file_content, filedir, options);
    });
    
    return html;
}

module.exports = function (source) {
    const { context } = this._module;
    const options = this.getOptions();
    Object.assign(strConfig, options.string);
    
    source = parseFile(source, context, options.that);
    return source;
}

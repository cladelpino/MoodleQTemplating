const fs = require("fs");
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const csv = require('csv-parser');
const stripBom = require('strip-bom-stream');
const Entities = require('html-entities').XmlEntities;
 
const entities = new Entities();

const basePath = ".\\data\\";
const baseFileName = "base4.xml";
const baseCategoryIndicator = "Variantes";
const baseQName = "CD-BOMBA-V0";
const newCategoryName = "/Variantes";
const dataFile = './data/data4.csv';
const outputFileName = "mod4.xml";

// const values = [
//     {'a':20,'b':40,'NUMERICAL':"40:1","MCVS":"Si,~No"},
//     {'a':30,'b':10,'NUMERICAL':"0.0586:0.005","MCVS":"Agua,~Birra"}
// ];

const values = [];

fs.createReadStream(dataFile).pipe(stripBom()).pipe(csv()).on('data', (data) => values.push(data)).on('end', () => {

    const stringContainingXMLSource = fs.readFileSync(basePath+baseFileName,"utf8").replace(/[\r]*\n[ ]*/g,"");
    const dom = new JSDOM(stringContainingXMLSource,{contentType:"text/xml"});
    const doc = dom.window.document;

    const catsInFile = Array.from(doc.querySelectorAll("category text")).filter(
        (e)=>strEndsIn(e.innerHTML,baseCategoryIndicator)
    );
    const baseCatNode = catsInFile[0].parentElement.parentElement;
    const baseCatClone = baseCatNode.cloneNode(true);
    baseCatClone.querySelector("category text").innerHTML += newCategoryName;

    const qNodeInFile = Array.from(doc.querySelectorAll("question name text")).filter(
        (e)=>e.innerHTML==baseQName
    );
    if(qNodeInFile.length == 0){ 
        throw new Error('Base question name not found');
    }
    const baseQNode = qNodeInFile[0].parentElement.parentElement;
    const qString = values.reduce((p,r)=>p+generateQuestionNode(baseQNode,r).outerHTML,"");

    const fileContents = `<?xml version="1.0" encoding="UTF-8"?><quiz>${baseCatClone.outerHTML}${qString}</quiz>`;
    fs.writeFileSync(basePath+outputFileName,fileContents);
    console.log("xx");
});

function generateQuestionNode(baseNode,valueMap){

    const processedObj = catObjKeys(valueMap,["NUMERICAL","MCVS"]);
    const numQArr = processedObj["NUMERICAL"];
    const multChoiceQArr = processedObj["MCVS"];

    const regularValueMap = objKeyForEach(processedObj["rem"],(k)=>entities.encode(k));

    const cloneNode = baseNode.cloneNode(true);

    const qTextNode = cloneNode.querySelector("questiontext text");
    let questionText = replaceValMapInStr(regularValueMap,qTextNode.innerHTML);

    questionText = numQArr.reduce((p,s)=>p.replace("{:NUMERICAL:=*}",`{:NUMERICAL:=${s}}`),questionText);
    questionText = multChoiceQArr.reduce((p,s)=>p.replace("{:MCVS:=*~*}",`{:MCVS:${s}}`),questionText);

    qTextNode.innerHTML = questionText;

    const gradersNode = cloneNode.querySelector("graderinfo text");
    gradersNode.innerHTML = replaceValMapInStr(regularValueMap,gradersNode.innerHTML);

    return cloneNode;
}

function replaceValMapInStr(valMap,str,patternL = "\\$\\{",patternR ="\\}"){
    return Object.keys(valMap).reduce((p,s)=>p.replace(new RegExp(patternL+escapeRegExp(s)+patternR,"g"),valMap[s]),str);
}

function escapeRegExp(string) {
    return string.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
  }

function objKeyForEach(obj,fn){
    const outObj = {};
    Object.keys(obj).forEach((k)=>outObj[fn(k)]=obj[k])
    return outObj;
}

function catObjKeys(obj, terms,otherWord = "rem"){
    const outObj = {};
    terms.forEach((t)=>outObj[t]=[]);
    outObj[otherWord] = {};
    keys = Object.keys(obj).forEach((k)=>{
            let found = false;
            terms.forEach((t)=>{
                if(strBeginsWith(k,t)){
                    outObj[t].push(obj[k])
                    found = true;
                };
            });
            if(!found){outObj[otherWord][k]=obj[k]}
        });
    return outObj;
}

function strBeginsWith(str,beginning){
    return str.indexOf(beginning)==0;
}

function strEndsIn(str,end){
    return str.lastIndexOf(end)==str.length-end.length;
}
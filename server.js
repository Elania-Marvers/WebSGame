const { time } = require('console');
const express = require('express');
const http = require('http');
const mysql = require('mysql');
const WebSocket = require('ws');
const port = 4242;
const server = http.createServer(express);
const wss = new WebSocket.Server({ server });

dbDrop();
dbDropGame();

wss.on('connection', function connection(ws) {
    ws.name = Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 7);
    dbSelect();
    console.log("Bonjour " + ws.name);
    ws.on('message', function incoming(data){
	data = JSON.parse(data);

	if(data['msg'] != null)
	{
	    console.log(ws.name + " a envoyé un message");
	    var game = -1;
	    if (data['msg'].startsWith('?') && data['msg'].indexOf('[') != -1 && data['msg'].indexOf('[') < data['msg'].indexOf(']'))
	    {
		var question = data['msg'].substr(1, data['msg'].indexOf('[') - 1);
		var response = data['msg'].substr(data['msg'].indexOf('[') + 1, data['msg'].indexOf(']'));
		response = response.substr(0, response.length - 1);
	    	sendAll(question, "msg");
		dbInsertQuestion(question, response);
		game = 1;
	    }
	    if (data['msg'].startsWith('!'))
	    {
		var answer = data['msg'].substr(1, data['msg'].length);
		answer = is_true(answer);
		game = 1;
	    }
	    if (game == -1)
		sendAll(data['msg'], "msg");
	    dbInsert([ws.name, data['msg']]);
	}
	else
	{
	    console.log(ws.name + " a changer de nom pour " + data['pseudo']);
	    dbInsert(["serveur",  ws.name + " c\\'est transformé en " + data['pseudo']]);
	    sendAll(data['pseudo'], "name");
	    ws.name = data['pseudo'];
	}
    });

    ws.on('close', function() {
	console.log("déconnecter " + ws.name);

	sendAll(null,"déconnect");
	dbInsert(["serveur", ws.name + " c\\'est déconnecter"]);
    });


    function is_true (answer)
    {
	return dbSelectAnswer(answer);
    }
    
    function sendAll(data, method)
    {
	wss.clients.forEach(function each(client){
	    if (client.readyState == WebSocket.OPEN) {
		const now = new Date();
		
		if(method == "déconnect")
		{
		    msg = 'serveur (' + now.getHours() + ':' + now.getMinutes() + ')> ' + ws.name + " c'est déconnecter";
		}
		else if(method == "connect")
		{
		    msg = 'serveur (' + now.getHours() + ':' + now.getMinutes() + ')> ' + ws.name + " c'est connecter";
		}
		else if(method == "name")
		{
		    oldName = ws.name;
		    msg = 'serveur (' + now.getHours() + ':' + now.getMinutes() + ')> ' + ws.name + " c'est transformé en " + data;
		}
		else if(method == "msg")
		{
		    msg = ws.name + ' (' + now.getHours() + ':' + now.getMinutes() + ')> ' + data;
		}
		else if(method == "srv")
		{
		    msg = "Server" + ' (' + now.getHours() + ':' + now.getMinutes() + ')> ' + data;
		}

		client.send(msg);
	    }
	    
	});
    }

    function dbSelect()
    {	
	con = dbJoin();
	
	con.connect(function(err) {
	    if (err) throw err;
	    console.log("Connecté à la base de données MySQL!");
	    con.query("SELECT * FROM messages", function (err, result) {
		if (err) throw err;
		result.forEach(oldMsg);
		const now = new Date();
		sendAll(null, "connect");
		dbInsert(["serveur", ws.name + " c\\'est connecter"]);
	    });
	});
    }


    function dbSelectAnswer(answer)
    {	
	con = dbJoin();
	con.connect(function(err) {
	    if (err) throw err;
	    con.query("SELECT * FROM game ORDER BY ID DESC LIMIT 1", function (err, result) {
		if (err) throw err;
		if (result[0]['answer'] === answer)
		{
		    answer = ws.name + " you won with " + answer;
		    dbDropGame();
		}
		else if (result[0]['answer'] !== answer && result[0]['try'] + 1 == 3)
		{
		    answer = "This question is lost ! with " + answer + " the answer was : " + result[0]['answer'];
		    dbDropGame();
		}
		else
		{
		    answer = ws.name + " you try " + answer + " but failed";
		}
		sendAll(answer, "srv");

		sql = "UPDATE `game` SET `try`=" + (parseInt(result[0]["try"]) + 1) + " ORDER BY ID DESC LIMIT 1";
		con.query(sql, function (err, result) {
		    if (err) throw err;
		    console.log("Update réussie");
		});
	    });
	});
    }
    
    function oldMsg(data)
    {
	var time = data.dateTime;
	time = time.getHours() + ":" + time.getMinutes();
	msg = data.author + " (" + time + ")> " + data.msg;
	ws.send(msg);
    }
});



server.listen(port, function() {
    console.log(`Listen on port ${port}!`);
});

function dbJoin()
{
    return con = mysql.createConnection({
	host: "localhost",
	user: "adol",
	password: "christin",
	database : "my_chat",
	insecureAuth : true
    });
}



function dbDrop()
{
    con = dbJoin();
    
    con.connect(function(err) {
	if (err) throw err;
	sql = "DELETE FROM messages";
	con.query(sql, function (err, result) {
	    if (err) throw err;
	    console.log("Suppresion réussie");
	});
    });
}

function dbDropGame()
{
    con = dbJoin();    
    con.connect(function(err) {
	if (err) throw err;
	sql = "DELETE FROM game";
	con.query(sql, function (err, result) {
	    if (err) throw err;
	    console.log("Suppresion réussie");
	});
    });
}

function dbInsert(data)
{
    con = dbJoin();
    
    con.connect(function(err) {
	if (err) throw err;
	sql = "INSERT INTO messages (author, msg) VALUES ('" + data[0] + "', '" + data[1] + "')";
	con.query(sql, function (err, result) {
	    if (err) throw err;
	    console.log("Insertion réussie");
	});
    });
}



function dbInsertQuestion(question, answer)
{
    console.log("question is " + question  + " answer is " + answer);
    con = dbJoin();
    con.connect(function(err) {
	if (err) throw err;
	console.log("INSERT INTO game (question, answer, try) VALUES ('" + question + "', '" + answer + "', '0')");
	sql = "INSERT INTO game (question, answer, try) VALUES ('" + question + "', '" + answer + "', '0')";
	console.log(sql);
	con.query(sql, function (err, result) {
	    if (err) throw err;
	    console.log("Insertion réussie");
	});
    });
}

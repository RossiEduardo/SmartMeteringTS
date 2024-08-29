// Import the 'express' module along with 'Request' and 'Response' types from express
import express, { Request, Response } from 'express';
import AppDataSource from './data-source';
import 'reflect-metadata';

// Create an Express application
const app = express();
// Specify the port number for the server
const port: number = 3000;

// Inicializa a conexão com o banco de dados e inicia o servidor
AppDataSource.initialize()
	.then(() => {
		console.log('Data Source has been initialized!');

		app.listen(port, () => {
			console.log(`Server is running on http://localhost:${port}`);
		});
	})
	.catch(error => {
		console.error('Error during Data Source initialization:', error);
	});

// Import the 'express' module along with 'Request' and 'Response' types from express
import express, { Request, Response } from 'express';
import AppDataSource from './data-source';
import 'reflect-metadata';
import routes from './routes/routes';
import { verify_token } from './utils/utils';
// Create an Express application
const app = express();
app.use(express.json());
app.use('/', routes);
app.use('/temp_images', verify_token, express.static('temp_images'));

// Specify the port number for the server
const port: number = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Initialize the connection to the database and start the server
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

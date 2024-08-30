import { DataSource } from 'typeorm';
import dotenv from 'dotenv';

dotenv.config();

const AppDataSource = new DataSource({
	type: 'mysql',
	host: process.env.DB_HOST,
	port: Number(process.env.DB_PORT),
	username: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_NAME,
	entities: ["src/entity/**/*{.js,.ts}"],
   	migrations: ["src/migrations/**/*{.js,.ts}"],
	synchronize: true,
	logging: true,
  	migrationsTableName: 'migrations',
});

export default AppDataSource;

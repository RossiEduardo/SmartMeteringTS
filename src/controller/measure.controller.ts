import { Request, Response } from 'express';
import { Measure } from '../entity/Measure';
import AppDataSource from '../data-source';
import { Between } from 'typeorm';
import { extract_measure_value, validate_data } from '../utils/utils';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Upload a new measurement to the system
// Parameters: image, customer_code, measure_datetime, measure_type
export async function upload_measurement(req: Request, res: Response) {
	let error_description: string = validate_data(req);
	// If was found any error, return a 400 status code with the error description
	if (error_description.length > 0) {
		res.status(400).json({
			error_code: 'INVALID_DATA',
			error_description: error_description
		});
		return;
	}

	// If the data is valid, extract the values from the request body
	const new_measure = new Measure();
	new_measure.image = req.body.image;
	new_measure.customer_code = req.body.customer_code;
	new_measure.measure_datetime = new Date(req.body.measure_datetime);
	new_measure.measure_type = req.body.measure_type;
	new_measure.uuid = crypto.randomUUID();
	let year: number = new_measure.measure_datetime.getFullYear();
	let month: number = new_measure.measure_datetime.getMonth() + 1;

	// Verify if ther isnt a measurement in the same month and year for that type of measurement
	const measure_repository = AppDataSource.getRepository(Measure);
	const existing_measure = await measure_repository.findOne({
		where: {
			customer_code: new_measure.customer_code,
			measure_type: new_measure.measure_type,
			measure_datetime: Between(new Date(year, month - 1, 1), new Date(year, month, 1))
		}
	});
	if (existing_measure) {
		res.status(409).json({
			error_code: 'DOUBLE_REPORT',
			error_description: 'Leitura do mês já realizada.'
		});
		return;
	}

	// Convert the base64 image to a buffer
	let img_without_metadata = new_measure.image.replace(/^data:image\/\w+;base64,/, '');
	let img_buffer = Buffer.from(img_without_metadata, 'base64');

	// Save the image in the system to be able to visualize it
	let file_name = `temp_image_${Date.now()}.jpg`;
	const temp_img_path = path.join('src/temp_images', file_name);
	fs.writeFileSync(temp_img_path, img_buffer);

	// Generate a temporary link
	const expiry_time = Date.now() + 3600000; // 1 hora de validade
	const token = `${expiry_time}:${crypto
		.createHash('sha256')
		.update(expiry_time + 'shopper_case')
		.digest('hex')}`;

	let image_url: string = `http://localhost:3000/temp_images/${file_name}?token=${token}`;

	new_measure.measure_value = await extract_measure_value(temp_img_path); // Value extracted from the image with Gemini

	// Save the new measure in the database
	await measure_repository.save(new_measure);

	// Success response
	res.status(200).json({
		image_url: image_url,
		measure_value: new_measure.measure_value,
		measure_uuid: new_measure.uuid
	});
}

// Confirm a measurement in the system
// Parameters: measure_uuid, measure_value
export async function confirm_measurement(req: Request, res: Response) {
	// Validate the request body, checking if uuid was string and measure_value was a number
	if (typeof req.body.measure_uuid !== 'string' || typeof req.body.measure_value !== 'number') {
		res.status(400).json({
			error_code: 'INVALID_DATA',
			error_decription: 'The fields measure_uuid and measure_value are required and must be of the correct type.'
		});
		return;
	}

	let measure_uuid: string = req.body.measure_uuid;
	let measure_value: number = req.body.measure_value;

	// Verify if the measure exists in the database
	const measure_repository = AppDataSource.getRepository(Measure);
	const existing_measure = await measure_repository.findOne({
		where: {
			uuid: measure_uuid
		}
	});

	if (!existing_measure) {
		res.status(404).json({
			error_code: 'MEASURE_NOT_FOUND',
			error_description: 'Leitura não encontrada.'
		});
		return;
	} else if (existing_measure.measure_confirmed) {
		res.status(409).json({
			error_code: 'ALREADY_CONFIRMED',
			error_description: 'Leitura já confirmada.'
		});
		return;
	}
	// Update the measure value
	existing_measure.measure_value = measure_value;
	await measure_repository.save(existing_measure);

	// Success response
	res.status(200).json({
		success: 'true'
	});
}

// List all measurements for a specific customer
// Parameters: customer_code, measure_type (optional)
export async function list_users_measurements(req: Request, res: Response) {
	let error_description: string = validate_data(req, true);
	// If was found any error, return a 400 status code with the error description
	if (error_description.length > 0) {
		res.status(400).json({
			error_code: 'INVALID_DATA',
			error_description: error_description
		});
		return;
	}

	let customer_code: string = req.params.customer_code;
	let measure_type: string = req.query.measure_type ? req.query.measure_type.toString() : '';
	let existing_measures: Measure[] = [];
	// Verify if the customer has any measurements
	const measure_repository = AppDataSource.getRepository(Measure);
	if (measure_type === '') {
		// Get all types of measurements
		existing_measures = await measure_repository.find({
			where: {
				customer_code: customer_code
			}
		});
	} else {
		// If the measure type is specified, get only that type of measurement
		existing_measures = await measure_repository.find({
			where: {
				customer_code: customer_code,
				measure_type: measure_type
			}
		});
	}
	if (existing_measures.length === 0) {
		res.status(404).json({
			error_code: 'MEASURES_NOT_FOUND',
			error_description: 'Nenhuma leitura encontrada.'
		});
		return;
	}

	const formatted_measures = existing_measures.map(measure => ({
		uuid: measure.uuid,
		measure_time: measure.measure_datetime,
		measure_type: measure.measure_type,
		has_confirmed: measure.measure_confirmed,
		img_url: measure.image
	}));

	// Success response
	res.status(200).json({
		customer_code: customer_code,
		measures: [formatted_measures]
	});
}

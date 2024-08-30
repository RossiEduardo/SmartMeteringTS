import { Request, Response } from 'express';
import { Measure } from '../entity/Measure';
import AppDataSource from '../data-source';
import { Between } from 'typeorm';
import { extract_measure_value, validate_data } from '../utils/utils';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

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
    new_measure.customer_code =  req.body.customer_code;
    new_measure.measure_datetime = new Date(req.body.measure_datetime);;
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
    if(existing_measure) {
        res.status(409).json({
            error_code: 'DOUBLE_REPORT',
            error_description: 'Leitura do mês já realizada.'
        });
        return;
    }
	// Save the new measure in the database
	await measure_repository.save(new_measure);

    // Convert the base64 image to a buffer
	let img_without_metadata = new_measure.image.replace(/^data:image\/\w+;base64,/, '');
	let img_buffer = Buffer.from(img_without_metadata, 'base64');

    // Save the image in the system to be able to visualize it
    let file_name = `temp_image_${Date.now()}.jpg`;
    const temp_img_path = path.join('src/temp_images', file_name);
    fs.writeFileSync(temp_img_path, img_buffer);

    // Generate a temporary link
    const expiry_time = Date.now() + 3600000; // 1 hora de validade
    const token = `${expiry_time}:${crypto.createHash('sha256').update(expiry_time + 'shopper_case').digest('hex')}`;
    
    let image_url: string = `http://localhost:3000/temp_images/${file_name}?token=${token}`;
    
    let measure_value = extract_measure_value(temp_img_path); // Valor da medição fazer usando o gemini

    // Success response
    res.status(200).json({
        image_url: image_url,
        measure_value: measure_value,
        measure_uuid: new_measure.uuid
    });
	
}

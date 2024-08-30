import { NextFunction, Request, Response } from 'express';
import { createHash } from 'crypto';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// GoogleGenerativeAI config
const configuration = new GoogleGenerativeAI(process.env.API_KEY);
const fileManager = new GoogleAIFileManager(process.env.API_KEY);
const model = configuration.getGenerativeModel({ model: 'gemini-1.5-pro' });

export function is_image(image: string): boolean {
	const base64_regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
	return base64_regex.test(image);
}

// Valid data received in the request body of the POST /upload endpoint
export function validate_upload_data(req: Request): string {
	let error_description: string = '';

	if (typeof req.body.image !== 'string' || !is_image(req.body.image)) {
		error_description += 'The image field is required and must be a valid base64 string.\n';
	}
	if (typeof req.body.customer_code !== 'string' || req.body.customer_code.length === 0) {
		error_description += 'The customer_code field is required and must be a non-empty string.\n';
	}
	if (typeof req.body.measure_datetime !== 'string' || isNaN(Date.parse(req.body.measure_datetime))) {
		error_description += 'The measure_datetime field is required and must be a valid date string.\n';
	}
	if (typeof req.body.measure_type !== 'string' || (req.body.measure_type.length !== 'WATER' && req.body.measure_type !== 'GAS')) {
		error_description += 'The measure_type field is required and must be either "WATER" or "GAS".\n';
	}

	return error_description;
}


// Verify if the string has a number and if it does return the value
function extract_number(texto: string): number {
    // Using regular expression to find all numbers in the string
    const resultado = texto.match(/\d+/);

    if (resultado) {
        // Converting the first number found to integer
        return parseInt(resultado[0], 10);
    } else {
        return -1;
    }
}

// Extract the measure value from the image using Google LLM
export async function extract_measure_value(image_filepath: string): Promise<number> {
    // Upload the file using the temporary file path
	const uploadResult = await fileManager.uploadFile(image_filepath, {
		mimeType: 'image/jpeg',
		displayName: 'Measure image'
	});

	// Define the prompt for the model
	let prompt: string =
		'You are a helpful AI bot that analyzes an image of a water or gas meter. Your task is to identify and return only the numerical reading from the meter.';

	const result = await model.generateContent([
		prompt,
		{
			fileData: {
				fileUri: uploadResult.file.uri,
				mimeType: uploadResult.file.mimeType
			}
		}
	]);

    // Extract the numerical value from the response
	let measure_value: number = extract_number(result.response.text());

	return measure_value;
}

// MIddleware to verify the temporary link
export function verify_token(req: Request, res: Response, next: NextFunction): void {
	let token: string = req.query.token as string;
	const now = Date.now();

	if (token) {
		const [expiryTime, hash] = token.split(':');

        // Valid if expiryTime is a valid number and creates the expected hash
		if (expiryTime && hash) {
			const expectedHash = createHash('sha256')
				.update(expiryTime + 'your-secret-key')
				.digest('hex');

            // Verify if the generated hash is equal to the token hash and if the token has not expired yet
			if (expectedHash === hash && now < parseInt(expiryTime, 10)) {
				return next(); // Token is valid
			}
		}
	}
}

import { NextFunction, Request, Response } from 'express';
import { createHash } from 'crypto';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export function is_image(image: string): boolean {
	const base64_regex = /^data:image\/(png|jpg|jpeg|gif|bmp|webp);base64,[a-zA-Z0-9+/]+={0,2}$/;
	return base64_regex.test(image);
}

// Valid data received in the request body of the POST /upload endpoint
export function validate_data(req: Request, case_insensitive_measure_type: boolean = false): string {
	let error_description: string = '';

	if ('image' in req.body) {
		if (typeof req.body.image !== 'string' || !is_image(req.body.image)) {
			error_description += 'The image field must be a valid base64 string.\n';
		}
	}

	if ('customer_code' in req.body) {
		if (typeof req.body.customer_code !== 'string' || req.body.customer_code.length === 0) {
			error_description += 'The customer_code field must be a non-empty string.\n';
		}
	}

	if ('measure_datetime' in req.body) {
		if (typeof req.body.measure_datetime !== 'string' || isNaN(Date.parse(req.body.measure_datetime))) {
			error_description += 'The measure_datetime field must be a valid date string.\n';
		}
	}

	if ('measure_type' in req.body) {
		let measure_type = req.body.measure_type;

		if (case_insensitive_measure_type) {
			measure_type = measure_type.toUpperCase();
		}

		if (typeof measure_type !== 'string' || (measure_type !== 'WATER' && measure_type !== 'GAS')) {
			error_description += 'The measure_type field must be either "WATER" or "GAS".\n';
		}
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
export async function extract_measure_value(image_filepath: string, mime_type: string): Promise<number> {
	// Initialize GoogleGenerativeAI with your API_KEY.
	const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
	const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);

	const model = genAI.getGenerativeModel({
		// Choose a Gemini model.
		model: 'gemini-1.5-flash'
	});
	// Upload the file and specify a display name.
	const uploadResponse = await fileManager.uploadFile(image_filepath, {
		mimeType: 'image/jpeg',
		displayName: 'Jetpack drawing'
	});
	// Generate content using text and the URI reference for the uploaded file.
	const result = await model.generateContent([
		{
			fileData: {
				mimeType: uploadResponse.file.mimeType,
				fileUri: uploadResponse.file.uri
			}
		},
		{
			text: 'You are a helpful AI bot that analyzes an image of a water or gas meter. Your task is to identify and return only the numerical reading from the meter.'
		}
	]);

	// Extract the numerical value from the response
	let measure_value: number = extract_number(result.response.text());
	return measure_value;
}

// Middleware to verify the temporary link
export function verify_token(req: Request, res: Response, next: NextFunction): void {
	let token: string = req.query.token as string;
	const now = Date.now();

	if (token) {
		const [expiryTime, hash] = token.split(':');

		// Valid if expiryTime is a valid number and creates the expected hash
		if (expiryTime && hash) {
			const expectedHash = createHash('sha256')
				.update(expiryTime + 'shopper_case')
				.digest('hex');

			// Verify if the generated hash is equal to the token hash and if the token has not expired yet
			if (expectedHash === hash && now < parseInt(expiryTime, 10)) {
				return next(); // Token is valid, proceed to the next middleware or route handler
			}
		}
	}

	// If the token is invalid or missing, send a 403 Forbidden response
	res.status(403).send('Invalid or expired token');
}

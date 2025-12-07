import { z } from 'zod';

// 1. UBAH PARAMETER DISINI: dari 'schema' menjadi 'schemaOrFn'
export const validateBody = (schemaOrFn) => async (req, res, next) => {
    try {
        let body = { ...req.body };

        const contentType = req.headers['content-type'] || '';
        if (contentType.includes('multipart/form-data')) {
            Object.keys(body).forEach((key) => {
                if (typeof body[key] === 'string') {
                    try {
                        const trimmed = body[key].trim();
                        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
                            (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
                            body[key] = JSON.parse(body[key]);
                        }
                    } catch (e) {
                    }
                }
            });
        }
        
        // 2. DISINI VARIABELNYA JADI COCOK
        const schema = typeof schemaOrFn === 'function' ? schemaOrFn(req) : schemaOrFn;
        
        // 3. Gunakan 'schema' yang sudah diproses
        const result = await schema.safeParseAsync(body);

        if (!result.success) {
            const formattedErrors = {};

            result.error.issues.forEach((issue) => {
                const fieldName = issue.path[0];
                if (fieldName) {
                    formattedErrors[fieldName] = {
                        message: issue.message
                    };
                }
            });
            return res.status(422).json({
                statusCode: 422,
                statusMessage: "Validation Error",
                data: formattedErrors, 
            });
        }

        req.validatedBody = result.data;

        if (req.files || req.file) {
            const files = req.files || (req.file ? [req.file] : []);

            req.validatedBody.getFile = (fieldName) => {
                let foundFile;

                if (Array.isArray(files)) {
                    foundFile = files.find(f => f.fieldname === fieldName);
                } else if (typeof files === 'object') {
                    foundFile = files[fieldName]?.[0];
                }

                if (!foundFile) return null;

                return {
                    filename: foundFile.originalname,
                    type: foundFile.mimetype,
                    data: foundFile.buffer
                };
            };
        } else {
            req.validatedBody.getFile = () => null;
        }

        next();

    } catch (error) {
        console.error("Validation Middleware Error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
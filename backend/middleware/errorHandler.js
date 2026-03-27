/* ============================================
   VNK Automatisation Inc. - Error Handler
   ============================================ */

const errorHandler = (err, req, res, next) => {
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);

    // Validation errors
    if (err.type === 'validation') {
        return res.status(400).json({
            success: false,
            message: err.message,
            errors: err.errors
        });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            message: 'Invalid token.'
        });
    }

    // Database errors
    if (err.code && err.code.startsWith('23')) {
        return res.status(409).json({
            success: false,
            message: 'Data conflict. This record may already exist.'
        });
    }

    // Default server error
    res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'production'
            ? 'Internal server error.'
            : err.message
    });
};

module.exports = { errorHandler };
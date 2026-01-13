/**
 * Mock Weather Service
 * In production, this would call OpenWeatherMap or similar.
 */
const getWeatherForecast = async (location) => {
    // Returning dummy data for Field A/B
    return {
        location,
        forecast_date: new Date().toISOString().split('T')[0],
        temp_min: 22,
        temp_max: 34,
        rain_probability: 0.1, // 10% chance of rain
        condition: 'Sunny'
    };
};

const isRainExpected = async (location) => {
    const forecast = await getWeatherForecast(location);
    return forecast.rain_probability > 0.6; // Threshold for rain expectation
};

module.exports = { getWeatherForecast, isRainExpected };

const util = require('util');
const fs = require('fs');
const TrainingApi = require("@azure/cognitiveservices-customvision-training");
const PredictionApi = require("@azure/cognitiveservices-customvision-prediction");
const msRest = require("@azure/ms-rest-js");
// retrieve environment variables
const trainingKey = process.env["VISION_TRAINING_KEY"];
const trainingEndpoint = process.env["VISION_TRAINING_ENDPOINT"];

const predictionKey = process.env["VISION_PREDICTION_KEY"];
const predictionResourceId = process.env["VISION_PREDICTION_RESOURCE_ID"];
const predictionEndpoint = process.env["VISION_PREDICTION_ENDPOINT"];
//add fields the project name and a timeout parameter for asynchronous calls
const publishIterationName = "classifyModel";
const setTimeoutPromise = util.promisify(setTimeout);
//Authenticate the client
const credentials = new msRest.ApiKeyCredentials({ inHeader: { "Training-key": trainingKey } });
const trainer = new TrainingApi.TrainingAPIClient(credentials, trainingEndpoint);
const predictor_credentials = new msRest.ApiKeyCredentials({ inHeader: { "Prediction-key": predictionKey } });
const predictor = new PredictionApi.PredictionAPIClient(predictor_credentials, predictionEndpoint);
//create a new custom vision project
(async () => {
    console.log("Creating project...");
    const sampleProject = await trainer.createProject("Turners Car Suggestion");
    //add tags
    const hatchbackTag = await trainer.createTag(sampleProject.id, "Hatchback");
    const sedanTag = await trainer.createTag(sampleProject.id, "Sedan");
    
//upload and tag the image
const sampleDataRoot = "Images";

console.log("Adding images...");
let fileUploadPromises = [];

const hatchbackDir = `${sampleDataRoot}/Hatchback`;
const hatchbackFiles = fs.readdirSync(hatchbackDir);
hatchbackFiles.forEach(file => {
    fileUploadPromises.push(trainer.createImagesFromData(sampleProject.id, fs.readFileSync(`${hatchbackDir}/${file}`), { tagIds: [hatchbackTag.id] }));
});

const sedanDir = `${sampleDataRoot}/Sedan`;
const sedanFiles = fs.readdirSync(sedanDir);
sedanFiles.forEach(file => {
    fileUploadPromises.push(trainer.createImagesFromData(sampleProject.id, fs.readFileSync(`${sedanDir}/${file}`), { tagIds: [sedanTag.id] }));
});


await Promise.all(fileUploadPromises);
//train the project
console.log("Training...");
let trainingIteration = await trainer.trainProject(sampleProject.id);

// Wait for training to complete
console.log("Training started...");
while (trainingIteration.status == "Training") {
    console.log("Training status: " + trainingIteration.status);
    await setTimeoutPromise(1000, null);
    trainingIteration = await trainer.getIteration(sampleProject.id, trainingIteration.id)
}
console.log("Training status: " + trainingIteration.status);
// Publish the iteration to the end point
await trainer.publishIteration(sampleProject.id, trainingIteration.id, publishIterationName, predictionResourceId);

const testFile = fs.readFileSync(`${sampleDataRoot}/Test/testsedan.jpg`);

const results = await predictor.classifyImage(sampleProject.id, publishIterationName, testFile);

// Show results
console.log("Results:");
results.predictions.forEach(predictedResult => {
    console.log(`\t ${predictedResult.tagName}: ${(predictedResult.probability * 100.0).toFixed(2)}%`);
});
})()
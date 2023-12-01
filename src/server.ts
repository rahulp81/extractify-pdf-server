import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import dbConnect from "./utlilities/dbConnect";
import Files from "./models/Files";
import fsp from "fs/promises";
import { PDFDocument } from "pdf-lib";

dotenv.config();

const app = express();
const port = process.env.NODE_ENV === 'production' ? process.env.PORT : 3000;

dbConnect();

// Applied cors as well acess for content dispostion for all routes , to acess filename
app.use(
  cors({
    exposedHeaders: ["Content-Disposition"],
  })
);

app.use(express.json());

// Multer package for file Upload to diskStorage
const storage = multer.diskStorage({
  destination: path.resolve(__dirname, "..", "uploads"),
  filename(req, file, callback) {
    const fileName = `${Date.now()}-${file.originalname}`;
    callback(null, fileName);
  },
});

const upload = multer({ storage: storage });

// Rest API for File upload & storage to server
app.post("/upload", upload.single("pdfFile"), async (req, res) => {
  try {
    const uploadedFile = req.file;
    if (!uploadedFile) {
     return res.status(400).json({ error: "File is Missing Try Again" });
    }
    // Assigning id ans storing the actual path in db
    const path: any = await Files.create({
      path: req.file?.path,
      fileName : req.file?.originalname,
    });

    res.status(200).json({ message: "File uploaded successfully", path: path._id });
  } catch (error) {
    res.status(400).json({ error: "Something went wrong please try again" });
  }
});

// Rest API To retrieve a stored file from backend
app.get("/edit/:fileId", async (req, res) => {
  try {
    const fileId = req.params.fileId;
    const file: any = await Files.findById(fileId);
    const fileStream = fs.createReadStream(file.path);
    // Sending File through  stream using filestream read pipe to connect to res object to send data in chunks.
    res.setHeader("Content-Type", "application/pdf");
    fileStream.pipe(res);
  } catch (error) {
    console.log(error);
    res.status(400).json({ error: "Something went wrong please try again" });
  }
});

// Rest API for extracting selected Pages and creating a new File (use pdf-lib for the same)
app.post("/extract/:fileId", async (req, res) => {
  try {
    const fileId = req.params.fileId;
    const { selectedPages } = req.body;
    const file = await Files.findById(fileId);
    const filePath = file.path;
    const originalFileName = file.fileName;
    if (!filePath) {
      res.status(404);
    }
    if (!file) {
      return res.status(404).send("File not found");
    }

    const pdf = await fsp.readFile(file.path);
    const pdfDocToExtract = await PDFDocument.load(pdf);

    // Create a new PDF to store the copied pages
    const modifiedPdf = await PDFDocument.create();

    // Copying specified pages from the original PDF with seletedPages indices[0 based] to extract
    const copiedPages = await modifiedPdf.copyPages(
      pdfDocToExtract,
      selectedPages
    );
    copiedPages.forEach((page) => modifiedPdf.addPage(page));


    const tempFolderPath = path.join(__dirname, "..", "temp");

    // Create a temp fodler if not there
    await fsp.mkdir(tempFolderPath, { recursive: true });

    const tempFileName = `${Date.now()}_modified_${originalFileName}`;
    const tempFilePath = path.join(tempFolderPath, tempFileName);

    // Save the modified PDF to the temp folfer
    await fsp.writeFile(tempFilePath, await modifiedPdf.save());

    // Set the response header for  download as well setting filename

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${originalFileName}`
    );
    res.setHeader("Content-Type", "application/pdf");

    res.sendFile(tempFilePath, async (err) => {
      if (err) {
        console.error("Error during download:", err);
      } else {
        console.log(
          "Download complete. Deleting temporary file:",
          tempFilePath
        );
        // Cleanup: delete the temporary file after send is complete
        try {
          await fsp.unlink(tempFilePath);
          console.log("Temporary file deleted successfully.");
        } catch (deleteErr) {
          console.error("Error deleting temporary file:", deleteErr);
        }
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

app.listen(port, () => {
  console.log(`Server is listening at http://localhost:${port}`);
});

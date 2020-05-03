package com.nurixtx.delphi.common;

import com.amazonaws.HttpMethod;
import com.amazonaws.regions.Regions;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.AmazonS3ClientBuilder;
import com.amazonaws.services.s3.AmazonS3URI;
import com.amazonaws.services.s3.model.CannedAccessControlList;
import com.amazonaws.services.s3.model.GeneratePresignedUrlRequest;
import com.amazonaws.services.s3.model.ObjectMetadata;
import com.amazonaws.services.s3.model.PutObjectRequest;
import com.amazonaws.util.IOUtils;
import com.nurixtx.delphi.error.exception.ConnectionException;
import com.nurixtx.delphi.error.exception.FileUploadException;
import io.micronaut.context.annotation.Value;
import io.micronaut.http.MediaType;
import io.micronaut.http.server.types.files.StreamedFile;

import javax.inject.Singleton;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URISyntaxException;

@Singleton
public class AmazonS3Service {

    @Value("${delphi.s3.bucket}")
    private String s3bucket;

    private AmazonS3 getS3Client() {
        var s3client = AmazonS3ClientBuilder
                .standard()
                .withRegion(Regions.DEFAULT_REGION)
                .build();

        return s3client;
    }

    public String uploadFile(String folderName, String fileName, File file) {
        getS3Client().putObject(s3bucket, fileName, file);

        return getS3Client().getUrl(s3bucket, fileName).toExternalForm();
    }

    public String uploadFile(String folderName, String fileName, InputStream inputStream, String fileType) {
        try {
            var bytes = IOUtils.toByteArray(inputStream);
            var metaData = new ObjectMetadata();

            metaData.setContentLength(bytes.length);
            metaData.setContentType(fileType);

            var byteArrayInputStream = new ByteArrayInputStream(bytes);

            getS3Client().putObject(new PutObjectRequest(s3bucket, folderName + "/" + fileName, byteArrayInputStream, metaData).withCannedAcl(CannedAccessControlList.PublicRead));

            // TODO: Need to change this logic.
            var url = getS3Client().getUrl(s3bucket,
                    folderName + "/" + fileName).toString();
            StringBuilder sb = new StringBuilder(url);
            sb.deleteCharAt(4);
            var link = sb.toString();

            return link.replace("http://","https://");
        } catch (IOException exception) {
            throw new FileUploadException("Could not upload file " + exception);
        }
    }

    public StreamedFile downloadFile(String link) {
        try {
            var downloadLink = new URI(link);
            var s3Link = new AmazonS3URI(downloadLink);
            var bucket = s3Link.getBucket();
            var key = s3Link.getKey();
            var s3Object = getS3Client().getObject(bucket, key);
            var inputStream = s3Object.getObjectContent();
            var streamedFile = new StreamedFile(inputStream, MediaType.forFilename(key));

            streamedFile.attach(key);

            return streamedFile;
        } catch (URISyntaxException exception) {
            throw new ConnectionException("Could not download file " + exception);
        }
    }

    public void deleteFile(String link) throws URISyntaxException {
        var fileToBeDeleted = new URI(link);
        var s3URI = new AmazonS3URI(fileToBeDeleted);
        var key = s3URI.getKey();

        getS3Client().deleteObject(s3bucket, key);
    }

    /**
     * Uploads file to s3 and returns file path
     *
     * @param folderName  The folder name
     * @param fileName    The file name
     * @param inputStream The input stream
     * @param fileType    The file type
     * @return String
     */
    public String uploadFileAndGetFilePath(String folderName,
                                           String fileName,
                                           InputStream inputStream,
                                           String fileType) {
        try {
            var filePath = folderName + "/" + fileName;
            var bytes = IOUtils.toByteArray(inputStream);

            var metaData = new ObjectMetadata();
            metaData.setContentLength(bytes.length);
            metaData.setContentType(fileType);

            var byteArrayInputStream = new ByteArrayInputStream(bytes);

            getS3Client()
                    .putObject(new PutObjectRequest(s3bucket, filePath, byteArrayInputStream, metaData)
                            .withCannedAcl(CannedAccessControlList.Private));

            return filePath;
        } catch (IOException exception) {
            throw new FileUploadException(DelphiConstants.ExceptionMessage.UNABLE_TO_UPLOAD_FILE.toString() + exception);
        }
    }

    /**
     * Fetches pre signed url from s3
     *
     * @param filePath             The file path
     * @param expirationTimeMillis The expiration time in milliseconds
     * @return String
     */
    public String fetchPresignedUrl(String filePath, long expirationTimeMillis) {
        var expirationTime = new java.util.Date();

        expirationTimeMillis += expirationTime.getTime();

        expirationTime.setTime(expirationTimeMillis);

        var generatePresignedUrlRequest = new GeneratePresignedUrlRequest(s3bucket, filePath)
                .withMethod(HttpMethod.GET)
                .withExpiration(expirationTime);

        var presignedUrl = getS3Client().generatePresignedUrl(generatePresignedUrlRequest).toString();

        return presignedUrl;
    }

}

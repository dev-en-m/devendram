const imagePreview = document.querySelector("#image-preview");

if (imagePreview) {
    const previewImage = imagePreview.querySelector("img");
    const closePreview = imagePreview.querySelector("button");

    document.querySelectorAll(".work-preview").forEach((image) => {
        image.addEventListener("click", () => {
            previewImage.src = image.src;
            previewImage.alt = image.alt;
            imagePreview.showModal();
        });
    });

    closePreview.addEventListener("click", () => {
        imagePreview.close();
    });

    imagePreview.addEventListener("click", (event) => {
        if (event.target === imagePreview) {
            imagePreview.close();
        }
    });
}

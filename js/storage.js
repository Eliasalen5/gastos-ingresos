const StorageManager = {
    async upload(file, prefix) {
        try {
            const ext = file.name.split('.').pop();
            const fileName = `${prefix}_${Date.now()}.${ext}`;
            const ref = storage.ref(`receipts/${fileName}`);
            await ref.put(file);
            return await ref.getDownloadURL();
        } catch (e) {
            console.error('Error uploading:', e);
            return null;
        }
    },

    async delete(url) {
        try {
            const ref = storage.refFromURL(url);
            await ref.delete();
        } catch (e) {
            console.error('Error deleting:', e);
        }
    }
};
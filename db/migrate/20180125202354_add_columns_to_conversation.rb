class AddColumnsToConversation < ActiveRecord::Migration[5.1]
  def change
    add_column :conversations, :recipient_id, :integer
    add_index :conversations, :recipient_id
    add_column :conversations, :sender_id, :integer
    add_index :conversations, :sender_id
    add_index :conversations, %i[recipient_id sender_id], unique: true
  end
end

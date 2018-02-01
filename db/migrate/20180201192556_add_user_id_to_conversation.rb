class AddUserIdToConversation < ActiveRecord::Migration[5.1]
  def change
    add_column :conversations, :boy_id, :integer
    add_column :conversations, :girl_id, :integer
  end
end

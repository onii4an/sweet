class CreateConversations < ActiveRecord::Migration[5.1]
  def change
    create_table :conversations, &:timestamps
  end
end
